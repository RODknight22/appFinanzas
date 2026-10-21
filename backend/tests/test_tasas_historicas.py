"""Tasas de días pasados: lo anotado o importado con fecha antigua usa la tasa de su día."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import Moneda, OrigenTasa, TasaCambio
from app.services import divisas

HOY = date.today()
# Un lunes de hace unos meses (los lunes siempre tienen tasa del BCE).
ANTES = HOY - timedelta(days=200 + (HOY - timedelta(days=200)).weekday())


class FalsoFrankfurter:
    """Sustituye la descarga: devuelve las tasas indicadas (o falla) y anota cada petición."""

    def __init__(self, tasas: dict[date, tuple[float, float]] | None = None, error: Exception | None = None) -> None:
        self.tasas, self.error, self.urls = tasas or {}, error, []

    def __call__(self, url: str) -> object:
        self.urls.append(url)
        if self.error:
            raise self.error
        return {"rates": {d.isoformat(): {"EUR": eur, "MXN": mxn} for d, (eur, mxn) in self.tasas.items()}}


@pytest.fixture
def descargas(monkeypatch: pytest.MonkeyPatch, session: Session) -> FalsoFrankfurter:
    """Tasas automáticas activadas y solo la tasa de hoy guardada: 1 EUR = 18 / 0.9 = 20 MXN."""
    monkeypatch.setenv("TASAS_AUTOMATICAS", "true")
    monkeypatch.setattr(divisas, "_ultimo_fallo", None)
    monkeypatch.setattr(divisas, "_hay_tasas_de_hoy", lambda _s: True)  # la de hoy ya está
    for moneda, por_usd in ((Moneda.EUR, "0.9"), (Moneda.MXN, "18")):
        session.add(TasaCambio(moneda=moneda, por_usd=Decimal(por_usd), fecha=HOY, origen=OrigenTasa.API))
    session.commit()
    # Aquel lunes: 1 EUR = 18 / 0.8 = 22.50 MXN.
    falso = FalsoFrankfurter({ANTES: (0.8, 18)})
    monkeypatch.setattr(divisas, "_pedir_json_historico", falso)
    return falso


@pytest.fixture
def revolut(client: TestClient) -> dict:
    return client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()


def _importar(client: TestClient, cuenta: dict, fecha: date, monto: str = "10") -> None:
    categoria = client.post("/categorias", json={"nombre": "Metro", "tipo": "gasto"}).json()
    respuesta = client.post("/importaciones", json={"cuenta_id": cuenta["id"], "movimientos": [
        {"fecha": fecha.isoformat(), "monto": monto, "tipo": "gasto", "concepto": "Metro", "categoria_id": categoria["id"]},
    ]})
    assert respuesta.status_code == 201, respuesta.text


def test_extracto_antiguo_se_convierte_con_la_tasa_de_su_dia(
    client: TestClient, revolut: dict, descargas: FalsoFrankfurter
) -> None:
    _importar(client, revolut, ANTES)

    transaccion = client.get("/transacciones").json()[0]
    # Con la tasa de hoy serían 200 MXN; con la de aquel día, 225.
    assert transaccion["monto_principal"] == "225.00"
    assert len(descargas.urls) == 1  # una sola descarga para todo el periodo
    assert "symbols=EUR,MXN" in descargas.urls[0]


def test_lo_anotado_sin_internet_se_corrige_al_conseguir_las_tasas(
    client: TestClient, session: Session, revolut: dict, descargas: FalsoFrankfurter, monkeypatch: pytest.MonkeyPatch
) -> None:
    sin_red = FalsoFrankfurter(error=OSError("sin red"))
    monkeypatch.setattr(divisas, "_pedir_json_historico", sin_red)
    _importar(client, revolut, ANTES)
    assert client.get("/transacciones").json()[0]["monto_principal"] == "200.00"  # la tasa más cercana

    # Vuelve internet (p. ej. al reabrir la app, que rellena desde la primera transacción).
    monkeypatch.setattr(divisas, "_pedir_json_historico", descargas)
    monkeypatch.setattr(divisas, "_ultimo_fallo_historicas", None)
    divisas.asegurar_tasas_historicas(session, ANTES)
    session.commit()

    transaccion = client.get("/transacciones").json()[0]
    assert (transaccion["monto_cuenta"], transaccion["monto_principal"]) == ("10.00", "225.00")


def test_una_tasa_manual_nunca_se_pisa(session: Session, descargas: FalsoFrankfurter) -> None:
    session.add(TasaCambio(moneda=Moneda.EUR, por_usd=Decimal("0.7"), fecha=ANTES, origen=OrigenTasa.MANUAL))
    session.commit()

    divisas.asegurar_tasas_historicas(session, ANTES, ANTES)

    tasas = {t.moneda: t for t in session.exec(select(TasaCambio).where(TasaCambio.fecha == ANTES))}
    assert (tasas[Moneda.EUR].por_usd, tasas[Moneda.EUR].origen) == (Decimal("0.700000"), OrigenTasa.MANUAL)
    assert tasas[Moneda.MXN].por_usd == Decimal("18")  # la que faltaba sí se añade


def test_si_no_faltan_tasas_no_se_pide_nada_a_internet(session: Session, descargas: FalsoFrankfurter) -> None:
    for moneda in (Moneda.EUR, Moneda.MXN):
        session.add(TasaCambio(moneda=moneda, por_usd=Decimal(1), fecha=ANTES, origen=OrigenTasa.API))
    session.commit()

    divisas.asegurar_tasas_historicas(session, ANTES, ANTES)
    assert descargas.urls == []


def test_sin_internet_no_falla_y_no_reintenta_en_cada_peticion(
    session: Session, descargas: FalsoFrankfurter, monkeypatch: pytest.MonkeyPatch
) -> None:
    sin_red = FalsoFrankfurter(error=OSError("sin red"))
    monkeypatch.setattr(divisas, "_pedir_json_historico", sin_red)

    divisas.asegurar_tasas_historicas(session, ANTES)  # no lanza
    divisas.asegurar_tasas_historicas(session, ANTES)
    assert len(sin_red.urls) == 1


@pytest.mark.parametrize(
    "basura",
    [None, [], {"rates": "x"}, {"rates": {"no-es-fecha": {}}}, {"rates": {"2026-03-02": {"EUR": "0.9", "MXN": 18}}},
     {"rates": {"2026-03-02": {"EUR": float("nan"), "MXN": 18}}}, {"rates": {"2026-03-02": {"EUR": 0, "MXN": 18}}}],
)
def test_respuesta_basura_no_guarda_nada(
    session: Session, descargas: FalsoFrankfurter, monkeypatch: pytest.MonkeyPatch, basura: object
) -> None:
    monkeypatch.setattr(divisas, "_pedir_json_historico", lambda _url: basura)
    antes = len(session.exec(select(TasaCambio)).all())
    divisas.asegurar_tasas_historicas(session, ANTES)
    assert len(session.exec(select(TasaCambio)).all()) == antes


@pytest.mark.parametrize(
    ("dias_con_tasa", "hueco"),
    [
        ([0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 14], False),  # solo faltan fines de semana
        ([0, 1, 2, 10, 11, 14], True),  # una semana entera sin tasa
        ([5, 6, 7, 8, 9, 12, 13, 14], True),  # el principio del periodo no tiene tasa anterior
        ([0, 1, 2, 3], True),  # el final queda lejos de la última
        ([], True),
    ],
)
def test_detecta_huecos_pero_no_fines_de_semana(session: Session, dias_con_tasa: list[int], hueco: bool) -> None:
    for dia in dias_con_tasa:
        session.add(TasaCambio(moneda=Moneda.EUR, por_usd=Decimal(1), fecha=ANTES + timedelta(days=dia), origen=OrigenTasa.API))
    session.commit()
    assert divisas._hay_huecos(session, Moneda.EUR, ANTES, ANTES + timedelta(days=14)) is hueco


def test_las_transacciones_en_la_moneda_principal_no_cambian(
    client: TestClient, cuenta: dict, descargas: FalsoFrankfurter
) -> None:
    """Una cuenta en MXN con principal MXN no necesita tasas: ni descarga ni cambios."""
    _importar(client, cuenta, ANTES, monto="99.90")
    transaccion = client.get("/transacciones").json()[0]
    assert (transaccion["monto_cuenta"], transaccion["monto_principal"]) == ("99.90", "99.90")
