"""Conexión a SQLite y sesiones de base de datos.

Este es el único archivo que sabe *dónde* vive la base de datos. El resto del
código solo pide una sesión mediante `SessionDep`.
"""

import os
import unicodedata
from collections.abc import Generator
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

# La carpeta de datos se puede cambiar con la variable de entorno DATA_DIR.
# En Docker vale "/data" (un volumen montado); en local, por defecto usamos la
# carpeta data/ en la raíz del repositorio. Así los datos sobreviven aunque se
# borre el contenedor.
_REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("DATA_DIR", _REPO_ROOT / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{(DATA_DIR / 'finance.db').as_posix()}"

# check_same_thread=False: FastAPI atiende peticiones en varios hilos y SQLite,
# por defecto, solo permite usar una conexión desde el hilo que la creó.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def normalizar_texto(texto: str | None) -> str | None:
    """Minúsculas y sin tildes: "Educación" → "educacion". Para buscar sin importar cómo se escriba.

    NFD separa cada letra de su tilde ("ó" → "o" + "́"); luego quitamos las tildes (categoría Mn).
    """
    if texto is None:
        return None
    descompuesto = unicodedata.normalize("NFD", texto.casefold())
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")


@event.listens_for(Engine, "connect")
def _preparar_conexion(dbapi_connection, _connection_record) -> None:
    """Se ejecuta en cada conexión nueva a SQLite (también en los tests)."""
    # SQLite ignora las claves foráneas salvo que se activen en cada conexión.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
    # LOWER() de SQLite solo entiende ASCII ("É" no pasa a "é"): registramos
    # nuestra función de Python para usarla en las búsquedas como sin_acentos(columna).
    dbapi_connection.create_function("sin_acentos", 1, normalizar_texto, deterministic=True)


def init_db() -> None:
    """Prepara la BD al arrancar: tablas nuevas, columnas nuevas y datos iniciales."""
    # Importaciones locales: models debe cargarse antes de create_all para
    # registrar las tablas, y así evitamos importaciones circulares.
    from app import models  # noqa: F401
    from app.datos_iniciales import crear_datos_iniciales
    from app.migraciones import aplicar_migraciones
    from app.services import divisas

    SQLModel.metadata.create_all(engine)
    with engine.begin() as conexion:  # begin(): commit automático al salir
        aplicar_migraciones(conexion)
    with Session(engine) as session:
        crear_datos_iniciales(session)
        # Tasas de cambio del día (si no hay internet, se usarán las últimas guardadas).
        divisas.asegurar_tasas_del_dia(session)


def get_session() -> Generator[Session, None, None]:
    """Abre una sesión por petición HTTP y la cierra al terminar."""
    with Session(engine) as session:
        yield session


# Atajo para declarar la dependencia en los endpoints: `session: SessionDep`.
SessionDep = Annotated[Session, Depends(get_session)]
