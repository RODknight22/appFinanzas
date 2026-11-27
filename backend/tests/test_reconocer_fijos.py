"""Reconocer un cobro o pago fijo al anotarlo a mano o importarlo (para no contarlo dos veces).

Escenario: la moneda principal es el euro; la nómina (2.000 EUR) llega a Revolut el 15 de cada
mes y el alquiler (800 EUR) sale de Revolut el día 1. Con las tasas de ejemplo
(18 MXN y 0,9 EUR por dólar), 1 EUR = 20 MXN.
"""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import IngresoRecurrente, Suscripcion, Transaccion
from app.services.plan_mes import plan_del_mes


@pytest.fixture
def escenario(client: TestClient, tasas: None) -> dict:
    assert client.patch("/configuracion", json={"moneda": "EUR"}).status_code == 200
    revolut = client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()
    bbva = client.post("/cuentas", json={"nombre": "BBVA", "tipo": "debito", "moneda": "MXN"}).json()
    sueldo = client.post("/categorias", json={"nombre": "Sueldo", "tipo": "ingreso"}).json()
    casa = client.post("/categorias", json={"nombre": "Casa", "tipo": "gasto"}).json()
    nomina = client.post("/ingresos-recurrentes", json={
        "nombre": "Nómina", "monto": "2000", "periodicidad": "mensual", "fecha_proximo_cobro": "2026-11-15",
        "cuenta_id": revolut["id"], "categoria_id": sueldo["id"],
    })
    assert nomina.status_code == 201, nomina.text
    alquiler = client.post("/suscripciones", json={
        "nombre": "Alquiler", "monto": "800", "periodicidad": "mensual", "fecha_proximo_pago": "2026-11-01",
        "moneda": "EUR", "cuenta_id": revolut["id"], "categoria_id": casa["id"],
    })
    assert alquiler.status_code == 201, alquiler.text
    return {
        "revolut": revolut, "bbva": bbva, "sueldo": sueldo, "casa": casa,
        "nomina": nomina.json(), "alquiler": alquiler.json(),
    }


def _candidatos(client: TestClient, tipo: str, monto: str, cuenta: dict, fecha: str, **extra: str) -> list[str]:
    respuesta = client.get("/fijos/candidatos", params={
        "tipo": tipo, "monto": monto, "cuenta_id": cuenta["id"], "fecha": fecha, **extra,
    })
    assert respuesta.status_code == 200, respuesta.text
    return [c["nombre"] for c in respuesta.json()]


def _anotar(client: TestClient, cuenta: dict, categoria: dict, monto: str, fecha: str) -> dict:
    respuesta = client.post("/transacciones", json={
        "monto": monto, "tipo": categoria["tipo"], "fecha": fecha,
        "categoria_id": categoria["id"], "cuenta_id": cuenta["id"],
    })
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


# ---------------------------------------------------------------------------
# Candidatos
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("fecha", "parece"),
    [
        ("2026-11-15", True),
        ("2026-11-22", True),  # una semana tarde
        ("2026-11-23", False),
        ("2026-11-08", True),  # una semana antes
        ("2026-11-07", False),
    ],
)
def test_candidatos_con_margen_de_una_semana(client: TestClient, escenario: dict, fecha: str, parece: bool) -> None:
    assert (_candidatos(client, "ingreso", "2000", escenario["revolut"], fecha) == ["Nómina"]) is parece


@pytest.mark.parametrize(
    ("monto", "parece"),
    [("2200", True), ("2200.01", False), ("1800", True), ("1799.99", False)],
)
def test_candidatos_con_margen_del_diez_por_ciento(client: TestClient, escenario: dict, monto: str, parece: bool) -> None:
    assert (_candidatos(client, "ingreso", monto, escenario["revolut"], "2026-11-15") == ["Nómina"]) is parece


def test_candidatos_atrasados_dentro_del_margen(client: TestClient, escenario: dict) -> None:
    # La nómina del 15 no se registró y el movimiento llega el 20: sigue siendo ella.
    assert _candidatos(client, "ingreso", "2000", escenario["revolut"], "2026-11-20") == ["Nómina"]


def test_candidatos_en_otra_moneda_se_comparan_con_la_tasa_del_dia(client: TestClient, escenario: dict) -> None:
    # 40.000 MXN a 20 MXN/EUR son 2.000 EUR; 50.000 MXN (2.500 EUR) ya no se parecen.
    assert _candidatos(client, "ingreso", "40000", escenario["bbva"], "2026-11-15") == ["Nómina"]
    assert _candidatos(client, "ingreso", "50000", escenario["bbva"], "2026-11-15") == []
    # La moneda del movimiento puede no ser la de la cuenta: 2.000 EUR en la cuenta en pesos.
    assert _candidatos(client, "ingreso", "2000", escenario["bbva"], "2026-11-15", moneda="EUR") == ["Nómina"]


def test_candidatos_solo_del_mismo_tipo(client: TestClient, escenario: dict) -> None:
    assert _candidatos(client, "gasto", "2000", escenario["revolut"], "2026-11-15") == []
    assert _candidatos(client, "ingreso", "800", escenario["revolut"], "2026-11-01") == []
    assert _candidatos(client, "gasto", "800", escenario["revolut"], "2026-11-01") == ["Alquiler"]


def test_candidatos_prefieren_la_misma_cuenta_y_luego_la_fecha(client: TestClient, escenario: dict) -> None:
    for nombre, fecha, cuenta in (("Envío", "2026-11-14", "bbva"), ("Bono", "2026-11-18", "revolut")):
        respuesta = client.post("/ingresos-recurrentes", json={
            "nombre": nombre, "monto": "2000", "moneda": "EUR", "periodicidad": "mensual",
            "fecha_proximo_cobro": fecha, "cuenta_id": escenario[cuenta]["id"], "categoria_id": escenario["sueldo"]["id"],
        })
        assert respuesta.status_code == 201, respuesta.text
    # En Revolut: primero los de Revolut (Nómina, a 0 días; Bono, a 3) y después el de BBVA,
    # aunque su fecha esté más cerca que la del Bono.
    assert _candidatos(client, "ingreso", "2000", escenario["revolut"], "2026-11-15") == ["Nómina", "Bono", "Envío"]


def test_candidatos_a_igual_fecha_gana_el_importe_mas_cercano(client: TestClient, escenario: dict) -> None:
    respuesta = client.post("/ingresos-recurrentes", json={
        "nombre": "Extra", "monto": "2100", "periodicidad": "mensual", "fecha_proximo_cobro": "2026-11-15",
        "cuenta_id": escenario["revolut"]["id"], "categoria_id": escenario["sueldo"]["id"],
    })
    assert respuesta.status_code == 201
    assert _candidatos(client, "ingreso", "2090", escenario["revolut"], "2026-11-15") == ["Extra", "Nómina"]


# ---------------------------------------------------------------------------
# Reconocer un movimiento ya anotado
# ---------------------------------------------------------------------------
def test_reconocer_cobro_avanza_la_fecha_sin_crear_otro_movimiento(client: TestClient, escenario: dict) -> None:
    anotado = _anotar(client, escenario["revolut"], escenario["sueldo"], "2010", "2026-11-16")
    nomina = escenario["nomina"]
    respuesta = client.post(f"/ingresos-recurrentes/{nomina['id']}/reconocer", json={
        "transaccion_id": anotado["id"], "fecha_prevista": "2026-11-15",
    })
    assert respuesta.status_code == 200, respuesta.text
    # Desde la fecha prevista (15), no desde la real (16).
    assert respuesta.json()["fecha_proximo_cobro"] == "2026-12-15"
    transacciones = client.get("/transacciones").json()
    assert len(transacciones) == 1
    assert transacciones[0]["ingreso_recurrente_id"] == nomina["id"]


def test_reconocer_pago_marca_el_gasto_como_pago_fijo(client: TestClient, escenario: dict) -> None:
    anotado = _anotar(client, escenario["revolut"], escenario["casa"], "800", "2026-11-02")
    alquiler = escenario["alquiler"]
    respuesta = client.post(f"/suscripciones/{alquiler['id']}/reconocer", json={
        "transaccion_id": anotado["id"], "fecha_prevista": "2026-11-01",
    })
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["fecha_proximo_pago"] == "2026-12-01"
    assert client.get(f"/transacciones/{anotado['id']}").json()["suscripcion_id"] == alquiler["id"]


def test_reconocer_dos_veces_se_rechaza(client: TestClient, escenario: dict) -> None:
    anotado = _anotar(client, escenario["revolut"], escenario["sueldo"], "2000", "2026-11-15")
    otro = _anotar(client, escenario["revolut"], escenario["sueldo"], "2000", "2026-11-15")
    ruta = f"/ingresos-recurrentes/{escenario['nomina']['id']}/reconocer"
    datos = {"transaccion_id": anotado["id"], "fecha_prevista": "2026-11-15"}
    assert client.post(ruta, json=datos).status_code == 200
    # Doble clic: la fecha que se veía ya no es la próxima.
    repetido = client.post(ruta, json={**datos, "transaccion_id": otro["id"]})
    assert repetido.status_code == 409
    assert "ya se había registrado" in repetido.json()["detail"]
    # El mismo movimiento no puede ser también el cobro siguiente.
    otra_vez = client.post(ruta, json={**datos, "fecha_prevista": "2026-12-15"})
    assert otra_vez.status_code == 409
    assert client.get(f"/ingresos-recurrentes/{escenario['nomina']['id']}").json()["fecha_proximo_cobro"] == "2026-12-15"


def test_reconocer_con_un_movimiento_que_no_encaja_no_cambia_nada(
    client: TestClient, session: Session, escenario: dict
) -> None:
    gasto = _anotar(client, escenario["revolut"], escenario["casa"], "2000", "2026-11-15")
    respuesta = client.post(f"/ingresos-recurrentes/{escenario['nomina']['id']}/reconocer", json={
        "transaccion_id": gasto["id"], "fecha_prevista": "2026-11-15",
    })
    assert respuesta.status_code == 400
    session.rollback()  # como al cerrar la sesión de la petición
    assert session.get(IngresoRecurrente, escenario["nomina"]["id"]).fecha_proximo_cobro == date(2026, 11, 15)
    assert session.get(Transaccion, gasto["id"]).ingreso_recurrente_id is None

    no_existe = client.post(f"/suscripciones/{escenario['alquiler']['id']}/reconocer", json={
        "transaccion_id": 9999, "fecha_prevista": "2026-11-01",
    })
    assert no_existe.status_code == 400


def test_registrar_cobro_tambien_guarda_de_que_fijo_vino(client: TestClient, escenario: dict) -> None:
    respuesta = client.post(f"/ingresos-recurrentes/{escenario['nomina']['id']}/registrar-cobro", json={})
    assert respuesta.status_code == 201
    assert respuesta.json()["transaccion"]["ingreso_recurrente_id"] == escenario["nomina"]["id"]


def test_el_plan_del_mes_ya_no_cuenta_doble_tras_reconocer(
    client: TestClient, session: Session, escenario: dict
) -> None:
    nomina = _anotar(client, escenario["revolut"], escenario["sueldo"], "2000", "2026-11-15")
    alquiler = _anotar(client, escenario["revolut"], escenario["casa"], "800", "2026-11-01")
    hoy = date(2026, 11, 20)

    antes = plan_del_mes(session, "2026-11", hoy)
    assert antes.ingresos_esperados == Decimal("4000.00")  # el problema: real + atrasado
    assert antes.pagos_fijos_total == Decimal("800.00")
    assert antes.sin_presupuesto_total == Decimal("800.00")  # el alquiler, como gasto suelto

    for ruta, transaccion, prevista in (
        (f"/ingresos-recurrentes/{escenario['nomina']['id']}/reconocer", nomina, "2026-11-15"),
        (f"/suscripciones/{escenario['alquiler']['id']}/reconocer", alquiler, "2026-11-01"),
    ):
        assert client.post(ruta, json={"transaccion_id": transaccion["id"], "fecha_prevista": prevista}).status_code == 200

    despues = plan_del_mes(session, "2026-11", hoy)
    assert (despues.ingresos_reales, despues.ingresos_atrasados) == (Decimal("2000.00"), Decimal("0.00"))
    assert despues.ingresos_esperados == Decimal("2000.00")
    assert (despues.pagos_fijos_pagados, despues.pagos_fijos_atrasados) == (Decimal("800.00"), Decimal("0.00"))
    assert despues.sin_presupuesto_total == Decimal("0.00")


# ---------------------------------------------------------------------------
# Importar un extracto
# ---------------------------------------------------------------------------
EXTRACTO = (
    "Fecha;Concepto;Importe;Saldo\n"
    "01/11/2026;TRANSFERENCIA ALQUILER NOVIEMBRE;-800,00;200,00\n"
    "14/11/2026;MERCADONA;-45,20;154,80\n"
    "15/11/2026;NOMINA ACME SL;1.990,00;2.144,80\n"
    "16/11/2026;BIZUM PAPA;2.000,00;4.144,80\n"
).encode()


def _vista_previa(client: TestClient, cuenta: dict) -> list[dict]:
    respuesta = client.post("/importaciones/vista-previa", params={"cuenta_id": cuenta["id"]}, content=EXTRACTO)
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()["filas"]


def _movimiento(fila: dict, con_fijo: bool = True) -> dict:
    fijo = fila["fijo"] if con_fijo else None
    return {
        "fecha": fila["fecha"], "monto": fila["monto"], "tipo": fila["tipo"], "concepto": fila["concepto"],
        "categoria_id": fila["categoria_id"],
        "fijo_id": fijo["id"] if fijo else None, "fijo_fecha_prevista": fijo["fecha_prevista"] if fijo else None,
    }


def test_la_vista_previa_sugiere_cada_fijo_en_una_sola_fila(client: TestClient, escenario: dict) -> None:
    filas = _vista_previa(client, escenario["revolut"])
    sugerencias = {f["concepto"]: (f["fijo"] or {}).get("nombre") for f in filas}
    # Las dos entradas de ~2.000 se parecen a la nómina, pero solo hay una nómina: se la queda
    # la del día 15 (fecha exacta), aunque la del 16 tenga el importe exacto.
    assert sugerencias == {
        "TRANSFERENCIA ALQUILER NOVIEMBRE": "Alquiler",
        "MERCADONA": None,
        "NOMINA ACME SL": "Nómina",
        "BIZUM PAPA": None,
    }
    alquiler = next(f for f in filas if f["concepto"].startswith("TRANSFERENCIA"))
    assert alquiler["fijo"]["tipo"] == "gasto"
    assert alquiler["fijo"]["fecha_prevista"] == "2026-11-01"


def test_importar_reconoce_los_fijos_marcados(client: TestClient, session: Session, escenario: dict) -> None:
    filas = _vista_previa(client, escenario["revolut"])
    respuesta = client.post("/importaciones", json={
        "cuenta_id": escenario["revolut"]["id"], "movimientos": [_movimiento(f) for f in filas],
    })
    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["reconocidos"] == 2

    assert client.get(f"/ingresos-recurrentes/{escenario['nomina']['id']}").json()["fecha_proximo_cobro"] == "2026-12-15"
    assert client.get(f"/suscripciones/{escenario['alquiler']['id']}").json()["fecha_proximo_pago"] == "2026-12-01"
    por_concepto = {t["notas"]: t for t in client.get("/transacciones").json()}
    assert por_concepto["NOMINA ACME SL"]["ingreso_recurrente_id"] == escenario["nomina"]["id"]
    assert por_concepto["TRANSFERENCIA ALQUILER NOVIEMBRE"]["suscripcion_id"] == escenario["alquiler"]["id"]
    assert por_concepto["BIZUM PAPA"]["ingreso_recurrente_id"] is None

    plan = plan_del_mes(session, "2026-11", date(2026, 11, 20))
    assert plan.ingresos_esperados == Decimal("3990.00")  # solo lo real: nada se prevé dos veces
    assert plan.pagos_fijos_pagados == Decimal("800.00")


def test_importar_sin_marcar_no_toca_los_fijos(client: TestClient, escenario: dict) -> None:
    filas = _vista_previa(client, escenario["revolut"])
    respuesta = client.post("/importaciones", json={
        "cuenta_id": escenario["revolut"]["id"], "movimientos": [_movimiento(f, con_fijo=False) for f in filas],
    })
    assert respuesta.status_code == 201
    assert respuesta.json()["reconocidos"] == 0
    assert client.get(f"/ingresos-recurrentes/{escenario['nomina']['id']}").json()["fecha_proximo_cobro"] == "2026-11-15"


def test_importar_el_mismo_fijo_en_dos_filas_se_rechaza(
    client: TestClient, session: Session, escenario: dict
) -> None:
    filas = _vista_previa(client, escenario["revolut"])
    nomina = next(f for f in filas if f["concepto"] == "NOMINA ACME SL")
    bizum = {**next(f for f in filas if f["concepto"] == "BIZUM PAPA"), "fijo": nomina["fijo"]}
    respuesta = client.post("/importaciones", json={
        "cuenta_id": escenario["revolut"]["id"], "movimientos": [_movimiento(nomina), _movimiento(bizum)],
    })
    assert respuesta.status_code == 400
    assert "dos filas" in respuesta.json()["detail"]
    session.rollback()
    assert session.get(IngresoRecurrente, escenario["nomina"]["id"]).fecha_proximo_cobro == date(2026, 11, 15)
    assert client.get("/transacciones").json() == []


def test_importacion_que_falla_no_avanza_ningun_fijo(client: TestClient, session: Session, escenario: dict) -> None:
    filas = _vista_previa(client, escenario["revolut"])
    movimientos = [_movimiento(f) for f in filas]
    movimientos[-1]["categoria_id"] = escenario["casa"]["id"]  # ingreso con categoría de gasto: inválido
    respuesta = client.post("/importaciones", json={"cuenta_id": escenario["revolut"]["id"], "movimientos": movimientos})
    assert respuesta.status_code == 400
    session.rollback()  # como al cerrar la sesión de la petición
    assert session.get(IngresoRecurrente, escenario["nomina"]["id"]).fecha_proximo_cobro == date(2026, 11, 15)
    assert session.get(Suscripcion, escenario["alquiler"]["id"]).fecha_proximo_pago == date(2026, 11, 1)
    assert client.get("/transacciones").json() == []


def test_importar_rechaza_un_fijo_en_una_transferencia(client: TestClient, escenario: dict) -> None:
    filas = _vista_previa(client, escenario["revolut"])
    nomina = _movimiento(next(f for f in filas if f["concepto"] == "NOMINA ACME SL"))
    nomina["cuenta_transferencia_id"] = escenario["bbva"]["id"]
    respuesta = client.post("/importaciones", json={"cuenta_id": escenario["revolut"]["id"], "movimientos": [nomina]})
    assert respuesta.status_code == 400
