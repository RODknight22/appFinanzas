"""Todo o nada: descargar tasas a mitad de una operación no debe confirmarla a medias."""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import Moneda, TasaCambio, Transaccion, Transferencia
from app.services import divisas

_TASAS_DE_HOY = {"result": "success", "rates": {"MXN": 18, "EUR": 0.9, "GTQ": 7.5, "HNL": 25}}


def _con_internet(monkeypatch: pytest.MonkeyPatch) -> None:
    """Hay internet: la primera operación del día descarga las tasas a mitad de camino."""
    monkeypatch.setenv("TASAS_AUTOMATICAS", "true")
    monkeypatch.setattr(divisas, "_pedir_json", lambda: _TASAS_DE_HOY)
    monkeypatch.setattr(divisas, "_ultimo_fallo", None)


@pytest.fixture
def descarga_de_hoy(monkeypatch: pytest.MonkeyPatch) -> None:
    _con_internet(monkeypatch)


def test_importacion_que_falla_no_deja_nada_a_medias(
    client: TestClient, session: Session, tasas: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    client.patch("/configuracion", json={"moneda": "MXN"})
    euros = client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()
    pesos = client.post("/cuentas", json={"nombre": "Banco MX", "tipo": "debito", "moneda": "MXN"}).json()
    gasto = client.post("/categorias", json={"nombre": "G", "tipo": "gasto"}).json()
    ingreso = client.post("/categorias", json={"nombre": "I", "tipo": "ingreso"}).json()
    envio = client.post("/transferencias", json={
        "monto_origen": "1000", "fecha": "2026-10-01",
        "cuenta_origen_id": pesos["id"], "cuenta_destino_id": euros["id"],
    }).json()  # lo que llegó a Revolut queda estimado

    _con_internet(monkeypatch)
    # Fila 1 completa el envío con lo que llegó de verdad; la 2 descarga las tasas de hoy; la 3
    # es inválida (categoría de ingreso en un gasto): no se debe guardar nada.
    respuesta = client.post("/importaciones", json={"cuenta_id": euros["id"], "movimientos": [
        {"fecha": "2026-10-01", "monto": "49", "tipo": "ingreso", "concepto": "From MXN",
         "categoria_id": ingreso["id"], "transferencia_a_completar_id": envio["id"]},
        {"fecha": "2026-10-02", "monto": "10", "tipo": "gasto", "concepto": "y", "categoria_id": gasto["id"]},
        {"fecha": "2026-10-03", "monto": "10", "tipo": "gasto", "concepto": "z", "categoria_id": ingreso["id"]},
    ]})

    assert respuesta.status_code == 400
    # En la app, cerrar la sesión de la petición deshace lo no confirmado; aquí se comparte.
    session.rollback()
    transferencia = session.get(Transferencia, envio["id"])
    assert transferencia is not None and transferencia.destino_estimado  # sigue estimada
    assert transferencia.monto_destino == Decimal(envio["monto_destino"])
    assert session.exec(select(Transaccion)).all() == []


def test_sin_cambios_pendientes_las_tasas_se_guardan(session: Session, descarga_de_hoy: None) -> None:
    # Un GET (p. ej. el panel) no tiene nada propio que confirmar: las tasas sí se guardan.
    divisas.asegurar_tasas_del_dia(session)
    session.rollback()
    tasa = session.exec(select(TasaCambio).where(TasaCambio.moneda == Moneda.EUR)).one()
    assert tasa.por_usd == Decimal("0.9")
