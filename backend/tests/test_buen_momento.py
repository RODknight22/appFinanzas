"""Buen momento para cambiar: la tasa de hoy frente a la media de los últimos 90 días."""

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Moneda, OrigenTasa, TasaCambio
from app.services import dashboard, notificaciones

HOY = date(2026, 10, 20)
# 29 días con tasa dentro de los 90 que acaban hoy (el de hace 90 días ya queda fuera), a 20 MXN por EUR.
FECHAS_ANTES = [HOY - timedelta(days=3 * i) for i in range(1, 30)]


def _tasa(session: Session, fecha: date, mxn_por_eur: str) -> None:
    por_usd_mxn = Decimal(18)
    session.add(TasaCambio(moneda=Moneda.MXN, por_usd=por_usd_mxn, fecha=fecha, origen=OrigenTasa.API))
    session.add(TasaCambio(
        moneda=Moneda.EUR, por_usd=(por_usd_mxn / Decimal(mxn_por_eur)).quantize(Decimal("0.000001")),
        fecha=fecha, origen=OrigenTasa.API,
    ))


def _anotar_cobro_en_pesos_y_gasto_en_euros(client: TestClient, cuenta: dict, ingreso: dict, gasto: dict) -> None:
    euros = client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()
    for cuenta_, categoria, tipo, monto in [(cuenta, ingreso, "ingreso", "40000"), (euros, gasto, "gasto", "1000")]:
        datos = {"monto": monto, "tipo": tipo, "fecha": "2026-10-01", "cuenta_id": cuenta_["id"], "categoria_id": categoria["id"]}
        assert client.post("/transacciones", json=datos).status_code == 201


@pytest.fixture
def con_tasa_de_hoy(
    client: TestClient, session: Session, cuenta: dict, categoria_ingreso: dict, categoria_gasto: dict
):
    """Prepara 90 días a 20 MXN por EUR, la tasa de hoy pedida y un cobro en pesos y un gasto en euros."""

    def preparar(mxn_por_eur: str) -> None:
        for fecha in FECHAS_ANTES:
            _tasa(session, fecha, "20")
        _tasa(session, HOY, mxn_por_eur)
        session.commit()
        _anotar_cobro_en_pesos_y_gasto_en_euros(client, cuenta, categoria_ingreso, categoria_gasto)

    return preparar


def _avisos_de_divisa(session: Session) -> list:
    return [a for a in notificaciones.generar(session, datetime(2026, 10, 20, 10)) if a.tipo == "divisa"]


def test_euro_barato_es_buen_momento_y_avisa_en_la_campana(session: Session, con_tasa_de_hoy) -> None:
    con_tasa_de_hoy("19.5")

    momento = dashboard.buen_momento(session, HOY)
    assert (momento.moneda_ingreso, momento.moneda_gasto, momento.dias) == (Moneda.MXN, Moneda.EUR, 90)
    # Media: 29 días a 20 y hoy a 19.5 = 19.9833; con ella, cada euro de hoy cuesta un 2.5 % menos.
    assert (momento.tasa_hoy, momento.tasa_media) == (Decimal("19.5000"), Decimal("19.9833"))
    assert (momento.tasa_minima, momento.tasa_maxima) == (Decimal("19.5000"), Decimal("20.0000"))
    assert (momento.rinde_porcentaje, momento.veredicto) == (Decimal("2.5"), "bueno")

    [aviso] = _avisos_de_divisa(session)
    # Una vez por semana: la clave cambia con la semana, no con el día.
    assert aviso.clave == "buen-momento:MXN-EUR:2026-43"
    assert aviso.titulo == "Buen momento para cambiar MXN a EUR"
    assert aviso.mensaje.startswith("1 EUR = 19,50 MXN: tu dinero rinde un 2,5 % más")


def test_euro_caro_es_mal_momento_y_no_avisa(session: Session, con_tasa_de_hoy) -> None:
    con_tasa_de_hoy("20.6")

    momento = dashboard.buen_momento(session, HOY)
    assert (momento.rinde_porcentaje, momento.veredicto) == (Decimal("-2.8"), "malo")
    assert _avisos_de_divisa(session) == []


def test_cerca_de_la_media_es_normal(session: Session, con_tasa_de_hoy) -> None:
    con_tasa_de_hoy("20.1")
    assert dashboard.buen_momento(session, HOY).veredicto == "normal"


def test_sin_historial_suficiente_no_compara(
    client: TestClient, session: Session, cuenta: dict, categoria_ingreso: dict, categoria_gasto: dict
) -> None:
    _tasa(session, HOY, "19")
    session.commit()
    _anotar_cobro_en_pesos_y_gasto_en_euros(client, cuenta, categoria_ingreso, categoria_gasto)

    momento = dashboard.buen_momento(session, HOY)
    assert (momento.moneda_ingreso, momento.moneda_gasto) == (Moneda.MXN, Moneda.EUR)
    assert (momento.tasa_hoy, momento.veredicto) == (None, None)
    assert _avisos_de_divisa(session) == []


def test_misma_moneda_no_aplica(
    client: TestClient, session: Session, cuenta: dict, categoria_ingreso: dict, categoria_gasto: dict
) -> None:
    for categoria, tipo in [(categoria_ingreso, "ingreso"), (categoria_gasto, "gasto")]:
        datos = {"monto": "100", "tipo": tipo, "fecha": "2026-10-01", "cuenta_id": cuenta["id"], "categoria_id": categoria["id"]}
        client.post("/transacciones", json=datos)

    assert client.get("/dashboard/buen-momento").json()["moneda_ingreso"] is None
    assert dashboard.buen_momento(session, HOY).veredicto is None
