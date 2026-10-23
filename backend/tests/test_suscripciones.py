from datetime import date

from fastapi.testclient import TestClient

from app.models import Periodicidad
from app.services.suscripciones import siguiente_fecha


def test_siguiente_fecha_respeta_meses_cortos() -> None:
    assert siguiente_fecha(date(2026, 1, 31), Periodicidad.MENSUAL) == date(2026, 2, 28)
    assert siguiente_fecha(date(2026, 12, 15), Periodicidad.MENSUAL) == date(2027, 1, 15)
    assert siguiente_fecha(date(2028, 2, 29), Periodicidad.ANUAL) == date(2029, 2, 28)
    assert siguiente_fecha(date(2026, 10, 18), Periodicidad.SEMANAL) == date(2026, 10, 25)


def test_registrar_pago_crea_gasto_y_avanza_fecha(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    suscripcion = client.post(
        "/suscripciones",
        json={
            "nombre": "Netflix",
            "monto": "15.99",
            "periodicidad": "mensual",
            "fecha_proximo_pago": "2026-10-20",
        },
    ).json()

    respuesta = client.post(
        f"/suscripciones/{suscripcion['id']}/registrar-pago",
        json={"cuenta_id": cuenta["id"], "categoria_id": categoria_gasto["id"]},
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["transaccion"]["monto"] == "15.99"
    assert cuerpo["transaccion"]["fecha"] == "2026-10-20"
    assert cuerpo["suscripcion"]["fecha_proximo_pago"] == "2026-11-20"


def test_registrar_pago_rechaza_categoria_de_ingreso(
    client: TestClient, cuenta: dict, categoria_ingreso: dict
) -> None:
    suscripcion = client.post(
        "/suscripciones",
        json={"nombre": "Gym", "monto": "30", "periodicidad": "mensual",
              "fecha_proximo_pago": "2026-10-20"},
    ).json()

    respuesta = client.post(
        f"/suscripciones/{suscripcion['id']}/registrar-pago",
        json={"cuenta_id": cuenta["id"], "categoria_id": categoria_ingreso["id"]},
    )

    assert respuesta.status_code == 400
    # La fecha no debe avanzar si el pago falló.
    actual = client.get(f"/suscripciones/{suscripcion['id']}").json()
    assert actual["fecha_proximo_pago"] == "2026-10-20"


def test_un_doble_clic_no_paga_dos_veces(client: TestClient, cuenta: dict, categoria_gasto: dict) -> None:
    suscripcion = client.post("/suscripciones", json={
        "nombre": "Netflix", "monto": "15.99", "periodicidad": "mensual", "fecha_proximo_pago": "2026-10-20",
    }).json()
    pago = {"cuenta_id": cuenta["id"], "categoria_id": categoria_gasto["id"], "fecha_prevista": "2026-10-20"}
    url = f"/suscripciones/{suscripcion['id']}/registrar-pago"

    assert client.post(url, json=pago).status_code == 201
    repetido = client.post(url, json=pago)  # el segundo clic llega con la misma fecha
    assert repetido.status_code == 409
    assert "20/11/2026" in repetido.json()["detail"]
    assert len(client.get("/transacciones").json()) == 1
