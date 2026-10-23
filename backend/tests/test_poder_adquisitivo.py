"""Poder adquisitivo: cuánto rinde lo que cobras en una moneda al gastarlo en otra."""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Moneda, OrigenTasa, TasaCambio

# Del 1 de noviembre de 2025 a septiembre de 2026, 1 EUR = 20 MXN (días 1 y 15 de cada mes);
# en octubre de 2026 el euro sube a 22 MXN: los pesos rinden menos.
FECHAS_ANTES = [date(a, m, d) for a, m in [(2025, 11), (2025, 12)] + [(2026, m) for m in range(1, 10)] for d in (1, 15)]
FECHAS_OCTUBRE = [date(2026, 10, 1), date(2026, 10, 15)]


def _tasa(session: Session, fecha: date, mxn_por_eur: str) -> None:
    por_usd_mxn = Decimal(18)
    session.add(TasaCambio(moneda=Moneda.MXN, por_usd=por_usd_mxn, fecha=fecha, origen=OrigenTasa.API))
    session.add(TasaCambio(
        moneda=Moneda.EUR, por_usd=(por_usd_mxn / Decimal(mxn_por_eur)).quantize(Decimal("0.000001")),
        fecha=fecha, origen=OrigenTasa.API,
    ))


@pytest.fixture
def tasas_del_anio(session: Session) -> None:
    for fecha in FECHAS_ANTES:
        _tasa(session, fecha, "20")
    for fecha in FECHAS_OCTUBRE:
        _tasa(session, fecha, "22")
    session.commit()


@pytest.fixture
def cuenta_eur(client: TestClient, tasas_del_anio: None) -> dict:
    return client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()


def _anotar(client: TestClient, cuenta: dict, categoria: dict, tipo: str, monto: str, fecha: str) -> None:
    datos = {"monto": monto, "tipo": tipo, "fecha": fecha, "cuenta_id": cuenta["id"], "categoria_id": categoria["id"]}
    assert client.post("/transacciones", json=datos).status_code == 201


def _poder(client: TestClient, mes: str = "2026-10") -> dict:
    return client.get("/dashboard/poder-adquisitivo", params={"mes_anio": mes}).json()


def test_cobrar_en_pesos_y_gastar_en_euros(
    client: TestClient, cuenta: dict, cuenta_eur: dict, categoria_ingreso: dict, categoria_gasto: dict
) -> None:
    _anotar(client, cuenta, categoria_ingreso, "ingreso", "44000", "2026-10-15")
    _anotar(client, cuenta_eur, categoria_gasto, "gasto", "1000", "2026-10-10")

    poder = _poder(client)
    assert (poder["moneda_ingreso"], poder["moneda_gasto"]) == ("MXN", "EUR")
    # 44 000 MXN a 22 = 2 000 EUR. Media: 22 días a 20 y 2 a 22 = 20.1667 MXN por EUR,
    # con la que habrían sido 2 181.82 EUR.
    assert (poder["ingresos"], poder["rindio"], poder["diferencia"]) == ("44000.00", "2000.00", "-181.82")
    assert (poder["tasa_mes"], poder["tasa_media_12_meses"]) == ("22.0000", "20.1667")
    assert poder["rinde_porcentaje"] == "-8.3"


def test_sin_ingresos_este_mes_usa_la_tasa_del_mes(
    client: TestClient, cuenta: dict, cuenta_eur: dict, categoria_ingreso: dict, categoria_gasto: dict
) -> None:
    _anotar(client, cuenta, categoria_ingreso, "ingreso", "40000", "2026-09-15")
    _anotar(client, cuenta_eur, categoria_gasto, "gasto", "1000", "2026-09-20")

    poder = _poder(client)
    assert (poder["ingresos"], poder["rindio"]) == (None, None)
    assert (poder["tasa_mes"], poder["rinde_porcentaje"]) == ("22.0000", "-8.3")


def test_misma_moneda_o_sin_historial_no_compara(
    client: TestClient, session: Session, cuenta: dict, categoria_ingreso: dict, categoria_gasto: dict
) -> None:
    _anotar(client, cuenta, categoria_ingreso, "ingreso", "40000", "2026-10-15")
    _anotar(client, cuenta, categoria_gasto, "gasto", "1000", "2026-10-16")
    assert _poder(client) == {
        "mes_anio": "2026-10", "moneda_ingreso": None, "moneda_gasto": None, "tasa_mes": None,
        "tasa_media_12_meses": None, "rinde_porcentaje": None, "ingresos": None, "rindio": None, "diferencia": None,
    }

    # Con gastos en euros pero solo dos días de tasas, la media de 12 meses no sería fiable.
    for fecha in FECHAS_OCTUBRE:
        _tasa(session, fecha, "22")
    session.commit()
    euros = client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()
    _anotar(client, euros, categoria_gasto, "gasto", "5000", "2026-10-16")
    poder = _poder(client)
    assert (poder["moneda_ingreso"], poder["moneda_gasto"], poder["tasa_media_12_meses"]) == ("MXN", "EUR", None)
