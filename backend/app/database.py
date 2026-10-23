"""Conexión a SQLite y sesiones de base de datos.

Este es el único archivo que sabe *dónde* vive la base de datos. El resto del
código solo pide una sesión mediante `SessionDep`.
"""

import os
import threading
import unicodedata
from collections.abc import Generator
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlalchemy import event, func
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine, select

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

# Solo en producción (lo activan el lanzador y la imagen Docker): WAL usa memoria
# compartida que falla en carpetas montadas de Docker en Windows (el entorno de desarrollo).
USAR_WAL = os.getenv("SQLITE_WAL") == "true"


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
    if USAR_WAL:
        cursor = dbapi_connection.cursor()
        # WAL: leer no espera a que termine una escritura (el dashboard lanza
        # muchas lecturas a la vez) y cada guardado es más rápido. NORMAL con WAL
        # nunca corrompe la BD; como mucho, un corte de luz pierde el último segundo.
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


def init_db() -> None:
    """Prepara la BD al arrancar: tablas nuevas, columnas nuevas y datos iniciales."""
    # Importaciones locales: models debe cargarse antes de create_all para
    # registrar las tablas, y así evitamos importaciones circulares.
    from app import models  # noqa: F401
    from app.datos_iniciales import crear_datos_iniciales
    from app.migraciones import aplicar_migraciones

    SQLModel.metadata.create_all(engine)
    with engine.begin() as conexion:  # begin(): commit automático al salir
        aplicar_migraciones(conexion)
    with Session(engine) as session:
        crear_datos_iniciales(session)
    # Tasas del día en segundo plano: sin internet, la descarga tardaría segundos en
    # fallar y la app no abriría hasta entonces. Mientras, se usan las últimas guardadas.
    threading.Thread(target=_descargar_tasas, daemon=True).start()


def _descargar_tasas() -> None:
    from app.models import Transaccion, Transferencia
    from app.services import divisas

    with Session(engine) as session:
        divisas.asegurar_tasas_del_dia(session)
        # Rellena los días pasados sin tasa (p. ej. lo anotado antes de instalar la app)
        # y corrige lo que se convirtió con una tasa aproximada.
        # También las transferencias: el coste de un envío se mide con la tasa de su fecha.
        fechas = [session.exec(select(func.min(modelo.fecha))).one() for modelo in (Transaccion, Transferencia)]
        primera = min((fecha for fecha in fechas if fecha is not None), default=None)
        if primera is not None:
            divisas.asegurar_tasas_historicas(session, primera)
            session.commit()


def get_session() -> Generator[Session, None, None]:
    """Abre una sesión por petición HTTP y la cierra al terminar."""
    with Session(engine) as session:
        yield session


# Atajo para declarar la dependencia en los endpoints: `session: SessionDep`.
SessionDep = Annotated[Session, Depends(get_session)]
