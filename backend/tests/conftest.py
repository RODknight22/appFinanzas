"""Fixtures compartidas: cada test usa una BD en memoria nueva y vacía.

Así los tests nunca tocan data/finance.db y no dependen unos de otros.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app import models  # noqa: F401  (registra las tablas en el metadata)
from app.database import get_session
from app.main import app


@pytest.fixture
def session() -> Generator[Session, None, None]:
    # StaticPool: todas las conexiones comparten la misma BD en memoria.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture
def client(session: Session) -> Generator[TestClient, None, None]:
    # Sustituimos la sesión real por la de test en todos los endpoints.
    app.dependency_overrides[get_session] = lambda: session
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def cuenta(client: TestClient) -> dict:
    respuesta = client.post(
        "/cuentas", json={"nombre": "Banco", "tipo": "banco", "balance_inicial": "1000"}
    )
    return respuesta.json()


@pytest.fixture
def categoria_gasto(client: TestClient) -> dict:
    return client.post("/categorias", json={"nombre": "Comida", "tipo": "gasto"}).json()


@pytest.fixture
def categoria_ingreso(client: TestClient) -> dict:
    return client.post("/categorias", json={"nombre": "Sueldo", "tipo": "ingreso"}).json()
