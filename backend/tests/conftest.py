"""Fixtures compartidas: cada test usa una BD en memoria nueva y vacía.

Así los tests nunca tocan data/finance.db y no dependen unos de otros.
"""

import os

# Los tests no deben depender de internet: sin descarga automática de tasas.
# Se fija antes de importar la app para que ningún código llegue a usarla.
os.environ["TASAS_AUTOMATICAS"] = "false"

from collections.abc import Generator
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app import models  # noqa: F401  (registra las tablas en el metadata)
from app.models import Moneda, OrigenTasa, TasaCambio, Usuario
from app.services import acceso, divisas
from app.database import get_session
from app.dependencias import requiere_sesion
from app.main import app


@pytest.fixture(autouse=True)
def _sin_internet_para_tasas_historicas(monkeypatch: pytest.MonkeyPatch) -> None:
    """Algunos tests activan las tasas automáticas: la descarga histórica nunca debe salir a la red."""

    def sin_red(_url: str) -> object:
        raise OSError("los tests no usan internet")

    monkeypatch.setattr(divisas, "_pedir_json_historico", sin_red)
    monkeypatch.setattr(divisas, "_ultimo_fallo_historicas", None)


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
def cliente_sin_sesion(session: Session) -> Generator[TestClient, None, None]:
    """Cliente "real": hay que registrarse o iniciar sesión como en la app."""
    app.dependency_overrides[get_session] = lambda: session
    acceso.reiniciar_freno_de_intentos()
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client(cliente_sin_sesion: TestClient) -> TestClient:
    """Cliente con sesión simulada: así cada test de datos no repite el login."""
    app.dependency_overrides[requiere_sesion] = lambda: Usuario(usuario="test", password_hash="")
    return cliente_sin_sesion


@pytest.fixture
def cuenta(client: TestClient) -> dict:
    respuesta = client.post(
        "/cuentas", json={"nombre": "Banco", "tipo": "debito", "balance_inicial": "1000"}
    )
    return respuesta.json()


@pytest.fixture
def categoria_gasto(client: TestClient) -> dict:
    return client.post("/categorias", json={"nombre": "Comida", "tipo": "gasto"}).json()


@pytest.fixture
def categoria_ingreso(client: TestClient) -> dict:
    return client.post("/categorias", json={"nombre": "Sueldo", "tipo": "ingreso"}).json()


# Tasas de ejemplo (unidades por 1 USD), con números redondos para que los
# resultados esperados se puedan calcular de cabeza.
TASAS_EJEMPLO = {Moneda.MXN: "18", Moneda.EUR: "0.9", Moneda.GTQ: "7.5", Moneda.HNL: "25"}


@pytest.fixture
def tasas(session: Session) -> None:
    """Guarda las tasas de ejemplo con fecha antigua: valen para cualquier transacción."""
    for moneda, por_usd in TASAS_EJEMPLO.items():
        session.add(TasaCambio(moneda=moneda, por_usd=Decimal(por_usd), fecha=date(2000, 1, 1), origen=OrigenTasa.API))
    session.commit()
