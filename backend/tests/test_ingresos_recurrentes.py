from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.models import Periodicidad
from app.services.periodicidad import siguiente_fecha


@pytest.mark.parametrize(
    ("actual", "esperada"),
    [
        (date(2026, 10, 15), date(2026, 10, 31)),
        (date(2026, 10, 31), date(2026, 11, 15)),
        (date(2026, 11, 15), date(2026, 11, 30)),
        (date(2027, 2, 15), date(2027, 2, 28)),  # febrero corto
        (date(2028, 2, 15), date(2028, 2, 29)),  # bisiesto
        (date(2026, 12, 31), date(2027, 1, 15)),  # cambio de año
        (date(2026, 10, 10), date(2026, 10, 15)),  # un día suelto se recoloca
        (date(2026, 10, 20), date(2026, 10, 31)),
    ],
)
def test_quincenas_caen_el_15_y_el_ultimo_dia(actual: date, esperada: date) -> None:
    assert siguiente_fecha(actual, Periodicidad.QUINCENAL) == esperada


def _crear(client: TestClient, cuenta: dict, categoria: dict, **extra) -> dict:
    datos = {
        "nombre": "Nómina",
        "monto": "15000",
        "periodicidad": "quincenal",
        "fecha_proximo_cobro": "2026-10-15",
        "cuenta_id": cuenta["id"],
        "categoria_id": categoria["id"],
        **extra,
    }
    return client.post("/ingresos-recurrentes", json=datos).json()


def test_crear_toma_la_moneda_de_la_cuenta(
    client: TestClient, categoria_ingreso: dict, tasas: None
) -> None:
    banco_eur = client.post("/cuentas", json={"nombre": "N26", "tipo": "debito", "moneda": "EUR"}).json()
    ingreso = _crear(client, banco_eur, categoria_ingreso)
    assert ingreso["moneda"] == "EUR"


def test_crear_rechaza_categoria_de_gasto(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    respuesta = client.post(
        "/ingresos-recurrentes",
        json={"nombre": "X", "monto": "10", "periodicidad": "mensual", "fecha_proximo_cobro": "2026-10-15",
              "cuenta_id": cuenta["id"], "categoria_id": categoria_gasto["id"]},
    )
    assert respuesta.status_code == 400


def test_registrar_cobro_crea_ingreso_y_avanza_fecha(
    client: TestClient, cuenta: dict, categoria_ingreso: dict
) -> None:
    ingreso = _crear(client, cuenta, categoria_ingreso)

    respuesta = client.post(f"/ingresos-recurrentes/{ingreso['id']}/registrar-cobro", json={})

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["transaccion"]["tipo"] == "ingreso"
    assert cuerpo["transaccion"]["monto"] == "15000.00"
    assert cuerpo["transaccion"]["fecha"] == "2026-10-15"
    assert cuerpo["ingreso"]["fecha_proximo_cobro"] == "2026-10-31"
    # El saldo de la cuenta (1 000 iniciales) refleja el cobro.
    saldos = client.get("/dashboard/resumen").json()["cuentas"]
    assert saldos[0]["saldo"] == "16000.00"


def test_registrar_cobro_con_monto_y_fecha_reales(
    client: TestClient, cuenta: dict, categoria_ingreso: dict
) -> None:
    ingreso = _crear(client, cuenta, categoria_ingreso)

    cuerpo = client.post(
        f"/ingresos-recurrentes/{ingreso['id']}/registrar-cobro",
        json={"monto": "14500.50", "fecha": "2026-10-16"},
    ).json()

    assert cuerpo["transaccion"]["monto"] == "14500.50"
    assert cuerpo["transaccion"]["fecha"] == "2026-10-16"
    # Se avanza desde la fecha prevista, no desde la real.
    assert cuerpo["ingreso"]["fecha_proximo_cobro"] == "2026-10-31"
    # El importe habitual no cambia por un cobro distinto.
    assert cuerpo["ingreso"]["monto"] == "15000.00"


def test_cobro_en_otra_divisa_se_convierte(
    client: TestClient, categoria_ingreso: dict, tasas: None
) -> None:
    # Envío de 1 800 MXN que llega a una cuenta en EUR: 1800 / 18 * 0.9 = 90 EUR.
    banco_eur = client.post("/cuentas", json={"nombre": "N26", "tipo": "debito", "moneda": "EUR"}).json()
    ingreso = _crear(client, banco_eur, categoria_ingreso, monto="1800", moneda="MXN")

    cuerpo = client.post(f"/ingresos-recurrentes/{ingreso['id']}/registrar-cobro", json={}).json()

    assert cuerpo["transaccion"]["moneda"] == "MXN"
    assert cuerpo["transaccion"]["monto_cuenta"] == "90.00"


def test_omitir_avanza_sin_crear_transaccion(
    client: TestClient, cuenta: dict, categoria_ingreso: dict
) -> None:
    ingreso = _crear(client, cuenta, categoria_ingreso, periodicidad="mensual")

    respuesta = client.post(f"/ingresos-recurrentes/{ingreso['id']}/omitir")

    assert respuesta.status_code == 200
    assert respuesta.json()["fecha_proximo_cobro"] == "2026-11-15"
    assert len(client.get("/transacciones").json()) == 0


def test_actualizar_valida_la_categoria(
    client: TestClient, cuenta: dict, categoria_ingreso: dict, categoria_gasto: dict
) -> None:
    ingreso = _crear(client, cuenta, categoria_ingreso)

    respuesta = client.patch(
        f"/ingresos-recurrentes/{ingreso['id']}", json={"categoria_id": categoria_gasto["id"]}
    )

    assert respuesta.status_code == 400
    actual = client.get(f"/ingresos-recurrentes/{ingreso['id']}").json()
    assert actual["categoria_id"] == categoria_ingreso["id"]


def test_listar_proximos_dias(client: TestClient, cuenta: dict, categoria_ingreso: dict) -> None:
    _crear(client, cuenta, categoria_ingreso, nombre="Atrasado", fecha_proximo_cobro="2000-01-01")
    _crear(client, cuenta, categoria_ingreso, nombre="Lejano", fecha_proximo_cobro="2999-01-01")

    nombres = [i["nombre"] for i in client.get("/ingresos-recurrentes?proximos_dias=7").json()]

    assert nombres == ["Atrasado"]


def test_no_se_borra_cuenta_ni_categoria_en_uso(
    client: TestClient, cuenta: dict, categoria_ingreso: dict
) -> None:
    _crear(client, cuenta, categoria_ingreso)

    assert client.delete(f"/cuentas/{cuenta['id']}").status_code == 409
    assert client.delete(f"/categorias/{categoria_ingreso['id']}").status_code == 409


def test_eliminar_conserva_las_transacciones(
    client: TestClient, cuenta: dict, categoria_ingreso: dict
) -> None:
    ingreso = _crear(client, cuenta, categoria_ingreso)
    client.post(f"/ingresos-recurrentes/{ingreso['id']}/registrar-cobro", json={})

    assert client.delete(f"/ingresos-recurrentes/{ingreso['id']}").status_code == 204
    assert len(client.get("/transacciones").json()) == 1
