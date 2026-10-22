"""Monedas por cuenta y por transacción, tasas de cambio y conversión.

Tasas de ejemplo (conftest.py): 1 USD = 18 MXN = 0.9 EUR = 7.5 GTQ = 25 HNL.
Por tanto 1 EUR = 18 / 0.9 = 20 MXN.
"""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session

from app.models import Moneda
from app.services import divisas
from app.services.errores import ReglaDeNegocioError


@pytest.fixture
def cuenta_mxn(client: TestClient) -> dict:
    return client.post("/cuentas", json={"nombre": "BBVA", "tipo": "debito", "balance_inicial": "10000"}).json()


def _gasto(client: TestClient, cuenta: dict, categoria: dict, monto: str, moneda: str | None = None,
           fecha: str = "2026-10-10") -> dict:
    datos = {"monto": monto, "tipo": "gasto", "fecha": fecha,
             "cuenta_id": cuenta["id"], "categoria_id": categoria["id"]}
    if moneda:
        datos["moneda"] = moneda
    respuesta = client.post("/transacciones", json=datos)
    assert respuesta.status_code == 201, respuesta.json()
    return respuesta.json()


@pytest.mark.usefixtures("tasas")
def test_convertir_pasa_por_el_dolar(session: Session) -> None:
    hoy = date.today()
    assert divisas.convertir(session, Decimal("100"), Moneda.EUR, Moneda.MXN, hoy) == Decimal("2000.00")
    assert divisas.convertir(session, Decimal("18"), Moneda.MXN, Moneda.USD, hoy) == Decimal("1.00")
    assert divisas.convertir(session, Decimal("75"), Moneda.GTQ, Moneda.HNL, hoy) == Decimal("250.00")


def test_cuenta_nueva_usa_la_moneda_principal(cuenta_mxn: dict) -> None:
    assert cuenta_mxn["moneda"] == "MXN"


@pytest.mark.usefixtures("tasas")
def test_gasto_en_euros_con_cuenta_en_pesos(
    client: TestClient, cuenta_mxn: dict, categoria_gasto: dict
) -> None:
    transaccion = _gasto(client, cuenta_mxn, categoria_gasto, "100", moneda="EUR")

    assert transaccion["moneda"] == "EUR"
    assert transaccion["monto"] == "100.00"  # el original no se toca
    assert transaccion["monto_cuenta"] == "2000.00"
    assert transaccion["monto_principal"] == "2000.00"

    resumen = client.get("/dashboard/resumen", params={"mes_anio": "2026-10"}).json()
    assert resumen["gastos"] == "2000.00"
    assert resumen["cuentas"][0]["saldo"] == "8000.00"  # 10000 - 2000


def test_sin_moneda_usa_la_de_la_cuenta(client: TestClient, cuenta_mxn: dict, categoria_gasto: dict) -> None:
    transaccion = _gasto(client, cuenta_mxn, categoria_gasto, "50")
    assert transaccion["moneda"] == "MXN"
    assert transaccion["monto_cuenta"] == "50.00"


def test_sin_tasas_no_se_puede_convertir(client: TestClient, cuenta_mxn: dict, categoria_gasto: dict) -> None:
    respuesta = client.post(
        "/transacciones",
        json={"monto": "10", "tipo": "gasto", "fecha": "2026-10-10", "moneda": "EUR",
              "cuenta_id": cuenta_mxn["id"], "categoria_id": categoria_gasto["id"]},
    )
    assert respuesta.status_code == 400
    assert "tasa de cambio" in respuesta.json()["detail"]


@pytest.mark.usefixtures("tasas")
def test_cada_transaccion_usa_la_tasa_de_su_fecha(
    client: TestClient, session: Session, cuenta_mxn: dict, categoria_gasto: dict
) -> None:
    antes = _gasto(client, cuenta_mxn, categoria_gasto, "100", moneda="EUR", fecha="2026-10-01")
    # El euro sube a 22 MXN (18 / 0.818181...) desde el 15 de octubre
    divisas.fijar_tasa_manual(session, Moneda.EUR, Decimal("0.818182"), fecha=date(2026, 10, 15))
    despues = _gasto(client, cuenta_mxn, categoria_gasto, "100", moneda="EUR", fecha="2026-10-20")

    assert antes["monto_cuenta"] == "2000.00"  # no cambia aunque cambie la tasa
    assert despues["monto_cuenta"] == "2200.00"
    assert client.get(f"/transacciones/{antes['id']}").json()["monto_cuenta"] == "2000.00"


@pytest.mark.usefixtures("tasas")
def test_cuenta_en_euros_suma_al_balance_convertida(client: TestClient) -> None:
    client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR", "balance_inicial": "500"})
    client.post("/cuentas", json={"nombre": "Cartera", "tipo": "efectivo", "balance_inicial": "1000"})

    resumen = client.get("/dashboard/resumen").json()
    revolut = next(c for c in resumen["cuentas"] if c["nombre"] == "Revolut")

    assert revolut["saldo"] == "500.00"
    assert revolut["moneda"] == "EUR"
    assert revolut["saldo_principal"] == "10000.00"
    assert resumen["balance_global"] == "11000.00"


@pytest.mark.usefixtures("tasas")
def test_cambiar_moneda_principal_recalcula_transacciones(
    client: TestClient, cuenta_mxn: dict, categoria_gasto: dict
) -> None:
    _gasto(client, cuenta_mxn, categoria_gasto, "2000")  # 2000 MXN = 100 EUR

    assert client.patch("/configuracion", json={"moneda": "EUR"}).status_code == 200

    resumen = client.get("/dashboard/resumen", params={"mes_anio": "2026-10"}).json()
    assert resumen["gastos"] == "100.00"


def test_monedas_activas(client: TestClient, cuenta_mxn: dict, categoria_gasto: dict) -> None:
    assert client.patch("/configuracion", json={"monedas_activas": ["MXN", "EUR"]}).json()["monedas_activas"] == ["MXN", "EUR"]
    # Una moneda desactivada no se acepta en registros nuevos
    respuesta = client.post(
        "/transacciones",
        json={"monto": "10", "tipo": "gasto", "fecha": "2026-10-10", "moneda": "GTQ",
              "cuenta_id": cuenta_mxn["id"], "categoria_id": categoria_gasto["id"]},
    )
    assert respuesta.status_code == 400
    # La principal (MXN) no se puede desactivar, ni dejar la lista vacía
    assert client.patch("/configuracion", json={"monedas_activas": ["EUR"]}).status_code == 400
    assert client.patch("/configuracion", json={"monedas_activas": []}).status_code == 400


@pytest.mark.usefixtures("tasas")
def test_no_se_cambia_la_moneda_de_una_cuenta_con_movimientos(
    client: TestClient, cuenta_mxn: dict, categoria_gasto: dict
) -> None:
    assert client.patch(f"/cuentas/{cuenta_mxn['id']}", json={"moneda": "EUR"}).status_code == 200
    _gasto(client, {"id": cuenta_mxn["id"]}, categoria_gasto, "10")
    assert client.patch(f"/cuentas/{cuenta_mxn['id']}", json={"moneda": "MXN"}).status_code == 409


@pytest.mark.usefixtures("tasas")
def test_suscripcion_en_dolares_pagada_con_cuenta_en_pesos(
    client: TestClient, cuenta_mxn: dict, categoria_gasto: dict
) -> None:
    suscripcion = client.post(
        "/suscripciones",
        json={"nombre": "Netflix", "monto": "15", "moneda": "USD", "periodicidad": "mensual",
              "fecha_proximo_pago": "2026-10-20"},
    ).json()
    pago = client.post(
        f"/suscripciones/{suscripcion['id']}/registrar-pago",
        json={"cuenta_id": cuenta_mxn["id"], "categoria_id": categoria_gasto["id"]},
    ).json()
    assert pago["transaccion"]["moneda"] == "USD"
    assert pago["transaccion"]["monto_cuenta"] == "270.00"  # 15 × 18


@pytest.fixture
def internet_simulado(monkeypatch: pytest.MonkeyPatch) -> None:
    """La "descarga" devuelve siempre estas tasas (por 1 USD): 1 EUR = 19 / 0.95 = 20 MXN."""
    monkeypatch.setattr(divisas, "descargar_tasas", lambda: {
        Moneda.MXN: Decimal("19"), Moneda.EUR: Decimal("0.95"), Moneda.GTQ: Decimal("7.6"), Moneda.HNL: Decimal("25"),
    })


def _por_moneda(tasas: list[dict]) -> dict[str, dict]:
    return {t["moneda"]: t for t in tasas}


@pytest.mark.usefixtures("internet_simulado")
def test_tasas_expresadas_en_la_moneda_principal(client: TestClient) -> None:
    tasas = _por_moneda(client.post("/tasas/actualizar").json())

    assert "MXN" not in tasas  # la principal no aparece: vale 1
    assert Decimal(tasas["USD"]["en_principal"]) == Decimal("19")  # el dólar es una más
    assert Decimal(tasas["EUR"]["en_principal"]) == Decimal("20")

    # Con el euro como principal, las mismas tasas se leen al revés
    client.patch("/configuracion", json={"moneda": "EUR"})
    tasas = _por_moneda(client.get("/tasas").json())
    assert Decimal(tasas["USD"]["en_principal"]) == Decimal("0.95")
    assert Decimal(tasas["MXN"]["en_principal"]) == Decimal("0.05")


@pytest.mark.usefixtures("internet_simulado")
def test_tasa_manual_en_la_principal_y_no_la_pisa_la_descarga(client: TestClient) -> None:
    client.post("/tasas/actualizar")

    tasas = _por_moneda(client.put("/tasas/EUR", json={"en_principal": "21"}).json())
    assert tasas["EUR"]["origen"] == "manual"
    assert abs(Decimal(tasas["EUR"]["en_principal"]) - 21) < Decimal("0.0001")

    tasas = _por_moneda(client.post("/tasas/actualizar").json())  # vuelve a "descargar"
    assert tasas["EUR"]["origen"] == "manual"
    assert abs(Decimal(tasas["EUR"]["en_principal"]) - 21) < Decimal("0.0001")

    # El dólar también se puede fijar; la principal no tiene tasa propia
    assert Decimal(_por_moneda(client.put("/tasas/USD", json={"en_principal": "20"}).json())["USD"]["en_principal"]) == 20
    assert client.put("/tasas/MXN", json={"en_principal": "2"}).status_code == 400


# ---------------------------------------------------------------------------
# Descarga robusta, tasas manuales acotadas, caché y recálculo en lote
# ---------------------------------------------------------------------------
_BUENAS = {"result": "success", "rates": {"MXN": 19, "EUR": 0.95, "GTQ": 7.6, "HNL": 25}}
_RESPUESTAS_BASURA = [
    pytest.param([1, 2, 3], id="lista"),
    pytest.param({"result": "success"}, id="sin-rates"),
    pytest.param({"result": "success", "rates": {"MXN": 19}}, id="falta-moneda"),
    pytest.param({"result": "success", "rates": {**_BUENAS["rates"], "EUR": 0}}, id="cero"),
    pytest.param({"result": "success", "rates": {**_BUENAS["rates"], "EUR": -1}}, id="negativa"),
    pytest.param({"result": "success", "rates": {**_BUENAS["rates"], "EUR": float("nan")}}, id="nan"),
    pytest.param({"result": "success", "rates": {**_BUENAS["rates"], "EUR": 5_000_000}}, id="enorme"),
    pytest.param({"result": "success", "rates": {**_BUENAS["rates"], "EUR": "0.9"}}, id="texto"),
]


@pytest.fixture(autouse=True)
def _sin_espera_previa() -> None:
    divisas._ultimo_fallo = None  # el estado global no debe pasar de un test a otro


@pytest.mark.parametrize("basura", _RESPUESTAS_BASURA)
def test_respuesta_basura_no_rompe_nada(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch, basura: object
) -> None:
    monkeypatch.setattr(divisas, "_pedir_json", lambda: basura)
    monkeypatch.setenv("TASAS_AUTOMATICAS", "true")

    divisas.asegurar_tasas_del_dia(session)  # no lanza
    assert divisas._ultimo_fallo is not None  # queda en espera para no reintentar en cada petición

    divisas._ultimo_fallo = None
    respuesta = client.post("/tasas/actualizar")
    assert respuesta.status_code == 503
    detalle = respuesta.json()["detail"]
    assert "tasas de cambio" in detalle
    for pista in ("KeyError", "ValueError", "nan", "rates", "Traceback"):
        assert pista not in detalle


def test_error_de_red_no_filtra_el_detalle(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def sin_red() -> object:
        raise OSError("getaddrinfo failed secreto.interno")

    monkeypatch.setattr(divisas, "_pedir_json", sin_red)
    respuesta = client.post("/tasas/actualizar")
    assert respuesta.status_code == 503
    assert "secreto" not in respuesta.json()["detail"]


def test_respuesta_buena_se_acepta(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(divisas, "_pedir_json", lambda: _BUENAS)
    assert divisas.descargar_tasas()[Moneda.EUR] == Decimal("0.95")


def test_tasa_manual_fuera_de_rango(client: TestClient, session: Session) -> None:
    assert client.put("/tasas/EUR", json={"en_principal": "0"}).status_code == 422
    assert client.put("/tasas/EUR", json={"en_principal": "2000000"}).status_code == 422
    # Una tasa que al redondear queda en 0 también se rechaza en el servicio
    with pytest.raises(ReglaDeNegocioError, match="fuera de rango"):
        divisas.fijar_tasa_manual(session, Moneda.EUR, Decimal("0.0000001"))


@pytest.mark.usefixtures("tasas")
def test_cache_de_tasas_en_la_sesion(session: Session) -> None:
    consultas: list[str] = []

    def contar(conn, cursor, statement, *args) -> None:  # noqa: ANN001
        consultas.append(statement)

    event.listen(session.get_bind(), "before_cursor_execute", contar)
    try:
        hoy = date.today()
        antes = divisas.tasa_por_usd(session, Moneda.EUR, hoy)
        n = len(consultas)
        assert divisas.tasa_por_usd(session, Moneda.EUR, hoy) == antes
        assert len(consultas) == n  # la segunda vez no toca la BD

        divisas.fijar_tasa_manual(session, Moneda.EUR, Decimal("0.5"))
        assert divisas.tasa_por_usd(session, Moneda.EUR, hoy) == Decimal("0.5")  # caché invalidada
    finally:
        event.remove(session.get_bind(), "before_cursor_execute", contar)


@pytest.mark.usefixtures("tasas")
def test_guardar_tasa_existente_actualiza_en_vez_de_duplicar(session: Session) -> None:
    divisas.fijar_tasa_manual(session, Moneda.EUR, Decimal("0.8"))
    divisas.fijar_tasa_manual(session, Moneda.EUR, Decimal("0.7"))  # mismo día y moneda
    assert divisas.tasa_por_usd(session, Moneda.EUR, date.today()) == Decimal("0.7")


@pytest.mark.usefixtures("tasas")
def test_recalcular_montos_en_lote(
    client: TestClient, session: Session, cuenta_mxn: dict, categoria_gasto: dict
) -> None:
    _gasto(client, cuenta_mxn, categoria_gasto, "2000")  # 2000 MXN
    _gasto(client, cuenta_mxn, categoria_gasto, "100", moneda="EUR")  # 100 EUR = 2000 MXN

    divisas.recalcular_montos_principales(session, Moneda.EUR)
    session.commit()

    montos = sorted(t["monto_principal"] for t in client.get("/transacciones").json())
    assert montos == ["100.00", "100.00"]


# --- Presupuestos en otra moneda ---------------------------------------------
def _presupuesto(client: TestClient, categoria: dict, limite: str, moneda: str | None = None) -> dict:
    datos = {"categoria_id": categoria["id"], "monto_limite": limite, "mes_anio": "2026-10"}
    if moneda:
        datos["moneda"] = moneda
    respuesta = client.post("/presupuestos", json=datos)
    assert respuesta.status_code == 201, respuesta.json()
    return respuesta.json()


def test_presupuesto_sin_moneda_usa_la_principal(client: TestClient, categoria_gasto: dict) -> None:
    assert _presupuesto(client, categoria_gasto, "500")["moneda"] == "MXN"


@pytest.mark.usefixtures("tasas")
def test_presupuesto_en_euros_mide_el_gasto_en_euros(
    client: TestClient, cuenta_mxn: dict, categoria_gasto: dict
) -> None:
    _presupuesto(client, categoria_gasto, "300", moneda="EUR")
    _gasto(client, cuenta_mxn, categoria_gasto, "100.01", moneda="EUR")  # exacto, sin ida y vuelta
    _gasto(client, cuenta_mxn, categoria_gasto, "2000")  # 2000 MXN = 100 EUR

    progreso = client.get("/dashboard/presupuestos", params={"mes_anio": "2026-10"}).json()[0]

    assert progreso["moneda"] == "EUR"
    assert progreso["gastado"] == "200.01"
    assert progreso["restante"] == "99.99"
    assert progreso["porcentaje"] == 66.7
    # En la principal, para los totales: 300 EUR = 6000 MXN.
    assert progreso["limite_principal"] == "6000.00"
    assert progreso["gastado_principal"] == "4000.20"


@pytest.mark.usefixtures("tasas")
def test_presupuesto_en_moneda_principal_no_convierte(
    client: TestClient, cuenta_mxn: dict, categoria_gasto: dict
) -> None:
    _presupuesto(client, categoria_gasto, "500")
    _gasto(client, cuenta_mxn, categoria_gasto, "10", moneda="EUR")  # 200 MXN

    progreso = client.get("/dashboard/presupuestos", params={"mes_anio": "2026-10"}).json()[0]

    assert progreso["gastado"] == progreso["gastado_principal"] == "200.00"
    assert progreso["limite_principal"] == "500.00"


def test_presupuesto_no_admite_moneda_desactivada(client: TestClient, categoria_gasto: dict) -> None:
    client.patch("/configuracion", json={"monedas_activas": ["MXN"]})
    respuesta = client.post(
        "/presupuestos",
        json={"categoria_id": categoria_gasto["id"], "monto_limite": "10", "mes_anio": "2026-10", "moneda": "EUR"},
    )
    assert respuesta.status_code == 400
