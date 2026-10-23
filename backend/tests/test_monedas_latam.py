"""Monedas de Latinoamérica: COP, ARS, CLP y PEN (tasas de ejemplo en conftest.py)."""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Moneda
from app.services import divisas


def test_las_nuevas_no_se_activan_solas(client: TestClient) -> None:
    # Quien nunca eligió monedas sigue viendo las de siempre en los formularios.
    assert client.get("/configuracion").json()["monedas_activas"] == ["MXN", "USD", "EUR", "GTQ", "HNL"]


def test_cuenta_en_pesos_colombianos_convierte_a_la_principal(
    client: TestClient, tasas: None, categoria_gasto: dict
) -> None:
    activas = client.patch("/configuracion", json={"monedas_activas": ["MXN", "COP"]}).json()["monedas_activas"]
    assert activas == ["MXN", "COP"]
    cuenta = client.post("/cuentas", json={"nombre": "Bancolombia", "tipo": "debito", "moneda": "COP"}).json()
    gasto = client.post("/transacciones", json={
        "monto": "40000", "tipo": "gasto", "fecha": "2026-10-10",
        "cuenta_id": cuenta["id"], "categoria_id": categoria_gasto["id"],
    }).json()
    # 40.000 COP = 10 USD = 180 MXN (1 USD = 4.000 COP = 18 MXN).
    assert gasto["moneda"] == "COP"
    assert gasto["monto_cuenta"] == "40000.00"
    assert gasto["monto_principal"] == "180.00"


@pytest.mark.parametrize(("moneda", "esperado"), [
    (Moneda.ARS, "18.00"),  # 1.000 ARS = 1 USD = 18 MXN
    (Moneda.CLP, "20.00"),  # 1.000 CLP = 1,11 USD
    (Moneda.PEN, "4800.00"),  # 1.000 PEN = 266,67 USD
])
def test_convertir_entre_monedas_de_latinoamerica(
    session: Session, tasas: None, moneda: Moneda, esperado: str
) -> None:
    assert divisas.convertir(session, Decimal(1000), moneda, Moneda.MXN, date(2026, 10, 10)) == Decimal(esperado)


def test_si_falta_una_moneda_se_guardan_las_demas() -> None:
    sin_cop = {"result": "success", "rates": {"MXN": 18, "EUR": 0.9, "ARS": 1000}}
    tasas = divisas._validar_tasas(sin_cop)
    assert tasas == {Moneda.MXN: Decimal("18"), Moneda.EUR: Decimal("0.9"), Moneda.ARS: Decimal("1000")}


def test_sin_ninguna_moneda_de_la_app_es_un_error() -> None:
    with pytest.raises(ValueError, match="ninguna moneda"):
        divisas._validar_tasas({"result": "success", "rates": {"JPY": 150}})
