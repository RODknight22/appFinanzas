"""Plan del mes: ingresos esperados, pagos fijos, presupuestos y gasto sin presupuesto.

Escenario de Rodrigo: cobra en pesos y gasta en euros. Su papá le envía 5000 MXN los
días 10, 20 y 30; la moneda principal es el euro. Con las tasas de ejemplo
(18 MXN y 0,9 EUR por dólar) 1 EUR = 20 MXN, así que cada envío son 250 EUR.
"""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.services.plan_mes import plan_del_mes

HOY = date(2026, 11, 15)


@pytest.fixture
def escenario(client: TestClient, tasas: None) -> dict:
    assert client.patch("/configuracion", json={"moneda": "EUR"}).status_code == 200
    mxn = client.post("/cuentas", json={"nombre": "BBVA", "tipo": "debito", "moneda": "MXN"}).json()
    eur = client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()
    envios = client.post("/categorias", json={"nombre": "Envíos", "tipo": "ingreso"}).json()
    ocio = client.post("/categorias", json={"nombre": "Ocio", "tipo": "gasto"}).json()
    comida = client.post("/categorias", json={"nombre": "Comida", "tipo": "gasto"}).json()
    papa = client.post(
        "/ingresos-recurrentes",
        json={
            "nombre": "Papá", "monto": "5000", "periodicidad": "varias_al_mes", "dias_de_cobro": [10, 20, 30],
            "fecha_proximo_cobro": "2026-11-10", "cuenta_id": mxn["id"], "categoria_id": envios["id"],
        },
    )
    assert papa.status_code == 201, papa.text
    return {"mxn": mxn, "eur": eur, "ocio": ocio, "comida": comida, "papa": papa.json()}


def _cobrar_papa(client: TestClient, escenario: dict) -> None:
    respuesta = client.post(f"/ingresos-recurrentes/{escenario['papa']['id']}/registrar-cobro", json={})
    assert respuesta.status_code == 201, respuesta.text


def _gasto(client: TestClient, cuenta: dict, categoria: dict, monto: str, fecha: str, notas: str | None = None) -> None:
    datos = {"monto": monto, "tipo": "gasto", "fecha": fecha, "cuenta_id": cuenta["id"],
             "categoria_id": categoria["id"], "notas": notas}
    assert client.post("/transacciones", json=datos).status_code == 201


def test_envios_del_papa_sin_contar_dos_veces(client: TestClient, session: Session, escenario: dict) -> None:
    _cobrar_papa(client, escenario)  # el del día 10 ya llegó: la próxima fecha pasa al 20

    plan = plan_del_mes(session, "2026-11", HOY)
    assert plan.estado == "actual"
    assert plan.ingresos_reales == Decimal("250.00")
    assert plan.ingresos_pendientes == Decimal("500.00")  # 20 y 30 de noviembre
    assert plan.ingresos_atrasados == Decimal("0.00")
    assert plan.ingresos_esperados == Decimal("750.00")  # tres envíos, ninguno repetido
    assert plan.porcentaje_mes_transcurrido == 50.0


def test_envio_atrasado_cuenta_en_su_mes(session: Session, escenario: dict) -> None:
    # Hoy 25: el del 10 y el del 20 no se registraron (atrasados), el del 30 aún no llega.
    plan = plan_del_mes(session, "2026-11", date(2026, 11, 25))
    assert (plan.ingresos_atrasados, plan.ingresos_pendientes) == (Decimal("500.00"), Decimal("250.00"))
    assert plan.ingresos_esperados == Decimal("750.00")
    # Un mes después, esos atrasados no se arrastran a diciembre: son de noviembre.
    diciembre = plan_del_mes(session, "2026-12", date(2026, 12, 1))
    assert diciembre.ingresos_atrasados == Decimal("0.00")


def test_mes_pasado_solo_real_y_futuro_solo_previsto(
    client: TestClient, session: Session, escenario: dict
) -> None:
    _cobrar_papa(client, escenario)
    pasado = plan_del_mes(session, "2026-11", date(2026, 12, 5))
    assert pasado.estado == "pasado"
    assert (pasado.ingresos_reales, pasado.ingresos_esperados) == (Decimal("250.00"), Decimal("250.00"))
    assert pasado.porcentaje_mes_transcurrido is None

    futuro = plan_del_mes(session, "2026-12", HOY)
    assert futuro.estado == "futuro"
    assert futuro.ingresos_reales == Decimal("0.00")
    assert futuro.ingresos_pendientes == Decimal("750.00")  # 10, 20 y 30 de diciembre


def test_plan_completo_con_pagos_fijos_y_presupuestos(client: TestClient, session: Session, escenario: dict) -> None:
    _cobrar_papa(client, escenario)
    eur, ocio, comida = escenario["eur"], escenario["ocio"], escenario["comida"]
    presupuesto = {"categoria_id": ocio["id"], "monto_limite": "100", "mes_anio": "2026-11"}
    assert client.post("/presupuestos", json=presupuesto).status_code == 201
    netflix = client.post("/suscripciones", json={
        "nombre": "Netflix", "monto": "15", "periodicidad": "mensual", "moneda": "EUR",
        "fecha_proximo_pago": "2026-11-05", "cuenta_id": eur["id"], "categoria_id": ocio["id"],
    }).json()
    assert client.post(f"/suscripciones/{netflix['id']}/registrar-pago", json={}).status_code == 201
    # El alquiler en pesos y sin categoría: 16 000 MXN = 800 EUR, pendiente el 28.
    client.post("/suscripciones", json={
        "nombre": "Alquiler", "monto": "16000", "periodicidad": "mensual", "moneda": "MXN",
        "fecha_proximo_pago": "2026-11-28",
    })
    _gasto(client, eur, ocio, "20", "2026-11-12")
    _gasto(client, eur, comida, "30", "2026-11-13")

    plan = plan_del_mes(session, "2026-11", HOY)
    assert (plan.pagos_fijos_pagados, plan.pagos_fijos_pendientes) == (Decimal("15.00"), Decimal("800.00"))
    assert plan.pagos_fijos_total == Decimal("815.00")
    assert plan.pagos_fijos_en_presupuestos == Decimal("15.00")  # Netflix ya lo cubre el límite de Ocio
    assert (plan.presupuestos_limite, plan.presupuestos_gastado) == (Decimal("100.00"), Decimal("35.00"))
    assert plan.porcentaje_presupuesto_gastado == 35.0
    # Sin presupuesto: solo Comida; Netflix es un pago fijo y Ocio tiene presupuesto.
    assert plan.sin_presupuesto_total == Decimal("30.00")
    assert [(g.nombre, g.total) for g in plan.sin_presupuesto] == [("Comida", Decimal("30.00"))]
    # 750 esperados − 800 del alquiler (Netflix ya va en Ocio) − 100 de límites.
    assert plan.por_asignar == Decimal("-150.00")
    assert plan.gastos_reales == Decimal("65.00")
    assert plan.disponible_real == Decimal("185.00")


def test_pago_fijo_anotado_antes_se_reconoce_por_la_nota(
    client: TestClient, session: Session, escenario: dict
) -> None:
    _gasto(client, escenario["eur"], escenario["comida"], "9.99", "2026-11-03", "Pago de suscripción: Spotify")
    plan = plan_del_mes(session, "2026-11", HOY)
    assert plan.pagos_fijos_pagados == Decimal("9.99")
    assert plan.sin_presupuesto == []


def test_sin_datos_ni_presupuestos(client: TestClient) -> None:
    respuesta = client.get("/dashboard/plan-mes", params={"mes_anio": "2026-11"})
    assert respuesta.status_code == 200
    plan = respuesta.json()
    assert plan["ingresos_esperados"] == plan["por_asignar"] == plan["presupuestos_limite"] == "0.00"
    assert plan["porcentaje_presupuesto_gastado"] == 0.0
    assert plan["sin_presupuesto"] == []
