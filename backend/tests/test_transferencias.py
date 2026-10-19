"""Transferencias: mueven saldos entre cuentas sin contar como ingreso ni gasto."""

from decimal import Decimal
from itertools import permutations

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TASAS_EJEMPLO


def _saldos(client: TestClient) -> dict[str, str]:
    cuentas = client.get("/dashboard/resumen").json()["cuentas"]
    return {c["nombre"]: c["saldo"] for c in cuentas}


@pytest.fixture
def ahorro(client: TestClient) -> dict:
    return client.post("/cuentas", json={"nombre": "Ahorro", "tipo": "debito"}).json()


@pytest.fixture
def cuenta_eur(client: TestClient, tasas: None) -> dict:
    return client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()


def _transferir(client: TestClient, origen: dict, destino: dict, **extra) -> dict:
    datos = {"cuenta_origen_id": origen["id"], "cuenta_destino_id": destino["id"],
             "monto_origen": "300", "fecha": "2026-10-01", **extra}
    respuesta = client.post("/transferencias", json=datos)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def test_mueve_saldos_y_no_cuenta_como_ingreso_ni_gasto(client: TestClient, cuenta: dict, ahorro: dict) -> None:
    transferencia = _transferir(client, cuenta, ahorro)

    assert transferencia["monto_destino"] == "300.00"
    assert _saldos(client) == {"Banco": "700.00", "Ahorro": "300.00"}
    resumen = client.get("/dashboard/resumen", params={"mes_anio": "2026-10"}).json()
    assert (resumen["ingresos"], resumen["gastos"]) == ("0.00", "0.00")
    assert resumen["balance_global"] == "1000.00"


def test_misma_cuenta_o_importe_distinto_en_misma_moneda_es_400(client: TestClient, cuenta: dict, ahorro: dict) -> None:
    datos = {"cuenta_origen_id": cuenta["id"], "cuenta_destino_id": cuenta["id"],
             "monto_origen": "10", "fecha": "2026-10-01"}
    assert client.post("/transferencias", json=datos).status_code == 400

    datos |= {"cuenta_destino_id": ahorro["id"], "monto_destino": "9"}
    assert client.post("/transferencias", json=datos).status_code == 400


def test_entre_monedas_guarda_el_tipo_de_cambio_real(client: TestClient, cuenta: dict, cuenta_eur: dict) -> None:
    # Con las tasas de ejemplo, 300 MXN son 15 EUR; el banco dio 14.50.
    estimada = _transferir(client, cuenta, cuenta_eur)
    assert estimada["monto_destino"] == "15.00"

    real = client.patch(f"/transferencias/{estimada['id']}", json={"monto_destino": "14.50"}).json()
    assert real["monto_destino"] == "14.50"
    assert _saldos(client)["Revolut"] == "14.50"

    # Si cambia lo que sale y no se indica lo que llega, se vuelve a estimar.
    recalculada = client.patch(f"/transferencias/{estimada['id']}", json={"monto_origen": "600"}).json()
    assert recalculada["monto_destino"] == "30.00"


def test_la_comision_es_un_gasto_enlazado(client: TestClient, cuenta: dict, ahorro: dict) -> None:
    transferencia = _transferir(client, cuenta, ahorro, comision="5")

    assert _saldos(client)["Banco"] == "695.00"
    gastos = client.get("/transacciones", params={"tipo": "gasto"}).json()
    assert len(gastos) == 1 and gastos[0]["transferencia_id"] == transferencia["id"]
    resumen = client.get("/dashboard/resumen", params={"mes_anio": "2026-10"}).json()
    assert resumen["gastos"] == "5.00"

    # Solo se gestiona desde la transferencia.
    assert client.delete(f"/transacciones/{gastos[0]['id']}").status_code == 409

    client.patch(f"/transferencias/{transferencia['id']}", json={"comision": "7"})
    assert client.get("/transacciones").json()[0]["monto"] == "7.00"

    client.patch(f"/transferencias/{transferencia['id']}", json={"comision": None})
    assert client.get("/transacciones").json() == []


def test_borrar_la_transferencia_borra_su_comision(client: TestClient, cuenta: dict, ahorro: dict) -> None:
    transferencia = _transferir(client, cuenta, ahorro, comision="5")

    assert client.delete(f"/transferencias/{transferencia['id']}").status_code == 204
    assert client.get("/transacciones").json() == []
    assert _saldos(client) == {"Banco": "1000.00", "Ahorro": "0.00"}


def test_pagar_tarjeta_reduce_la_deuda(client: TestClient, cuenta: dict) -> None:
    tarjeta = client.post(
        "/cuentas",
        json={"nombre": "Visa", "tipo": "credito", "balance_inicial": "-400", "dia_corte": 15, "dia_pago": 5},
    ).json()

    _transferir(client, cuenta, tarjeta, monto_origen="400")

    assert _saldos(client) == {"Banco": "600.00", "Visa": "0.00"}


def test_cuenta_con_transferencias_no_se_borra(client: TestClient, cuenta: dict, ahorro: dict) -> None:
    _transferir(client, cuenta, ahorro)
    assert client.delete(f"/cuentas/{ahorro['id']}").status_code == 409


def test_filtrar_por_cuenta(client: TestClient, cuenta: dict, ahorro: dict) -> None:
    otra = client.post("/cuentas", json={"nombre": "Otra", "tipo": "efectivo"}).json()
    _transferir(client, cuenta, ahorro)
    _transferir(client, otra, cuenta, monto_origen="1")

    assert len(client.get("/transferencias", params={"cuenta_id": cuenta["id"]}).json()) == 2
    assert len(client.get("/transferencias", params={"cuenta_id": ahorro["id"]}).json()) == 1


# --- Todas las divisas --------------------------------------------------------
# Unidades por 1 USD de las tasas de ejemplo (el USD no se guarda: vale 1).
_POR_USD = {"USD": Decimal(1), **{m.value: Decimal(v) for m, v in TASAS_EJEMPLO.items()}}
_MONEDAS = list(_POR_USD)


def _esperado(monto: str, de: str, a: str) -> str:
    return str((Decimal(monto) / _POR_USD[de] * _POR_USD[a]).quantize(Decimal("0.01")))


@pytest.mark.parametrize("principal", _MONEDAS)
@pytest.mark.parametrize(("de", "a"), list(permutations(_MONEDAS, 2)))
def test_cualquier_par_de_monedas_con_cualquier_principal(
    client: TestClient, tasas: None, principal: str, de: str, a: str
) -> None:
    assert client.patch("/configuracion", json={"moneda": principal}).status_code == 200
    origen = client.post("/cuentas", json={"nombre": "Origen", "tipo": "debito", "moneda": de, "balance_inicial": "1000"}).json()
    destino = client.post("/cuentas", json={"nombre": "Destino", "tipo": "debito", "moneda": a}).json()

    # Sin indicar lo que llega: se estima con la tasa de la fecha.
    transferencia = _transferir(client, origen, destino, monto_origen="100", comision="2")
    assert transferencia["monto_destino"] == _esperado("100", de, a)

    resumen = client.get("/dashboard/resumen", params={"mes_anio": "2026-10"}).json()
    saldos = {c["nombre"]: c for c in resumen["cuentas"]}
    assert saldos["Origen"]["saldo"] == "898.00"  # 1000 − 100 − 2 de comisión
    assert saldos["Destino"]["saldo"] == _esperado("100", de, a)
    # Solo la comisión es gasto, convertida a la moneda principal.
    assert resumen["gastos"] == _esperado("2", de, principal)
    assert resumen["ingresos"] == "0.00"

    # Con lo que llegó de verdad, el saldo de destino usa ese importe exacto.
    client.patch(f"/transferencias/{transferencia['id']}", json={"monto_destino": "12.34"})
    assert _saldos(client)["Destino"] == "12.34"


def test_cambiar_la_principal_reconvierte_la_comision(client: TestClient, tasas: None, cuenta: dict) -> None:
    revolut = client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()
    _transferir(client, cuenta, revolut, comision="18")  # 18 MXN = 1 USD = 0.90 EUR

    client.patch("/configuracion", json={"moneda": "EUR"})

    resumen = client.get("/dashboard/resumen", params={"mes_anio": "2026-10"}).json()
    assert resumen["gastos"] == "0.90"
