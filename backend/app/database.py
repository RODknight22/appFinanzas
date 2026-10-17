"""Conexión a SQLite y sesiones de base de datos.

Este es el único archivo que sabe *dónde* vive la base de datos. El resto del
código solo pide una sesión mediante `SessionDep`.
"""

import os
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


@event.listens_for(Engine, "connect")
def _activar_claves_foraneas(dbapi_connection, _connection_record) -> None:
    """SQLite ignora las claves foráneas salvo que se activen en cada conexión."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def init_db() -> None:
    """Crea las tablas que aún no existan (no modifica las existentes)."""
    # Importar los modelos los registra en SQLModel.metadata antes de crear tablas.
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Abre una sesión por petición HTTP y la cierra al terminar."""
    with Session(engine) as session:
        yield session


# Atajo para declarar la dependencia en los endpoints: `session: SessionDep`.
SessionDep = Annotated[Session, Depends(get_session)]
