"""Tipos de cuenta especiales: tarjeta de crédito y cuenta con rendimientos."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.services import cuentas as servicio
from app.services.errores import ReglaDeNegocioError


def test_tarjeta_de_credito_exige_dias_de_corte_y_pago(client: TestClient) -> None:
    datos = {"nombre": "Visa", "tipo": "credito", "balance_inicial": "-500"}
    assert client.post("/cuentas", json=datos).status_code == 400

    respuesta = client.post(
        "/cuentas", json={**datos, "dia_corte": 15, "dia_pago": 5, "limite_credito": "20000"}
    )
    assert respuesta.status_code == 201
    assert respuesta.json()["dia_corte"] == 15


def test_dia_fuera_de_rango_devuelve_422(client: TestClient) -> None:
    datos = {"nombre": "Visa", "tipo": "credito", "dia_corte": 32, "dia_pago": 5}
    assert client.post("/cuentas", json=datos).status_code == 422


def test_cambiar_de_tipo_borra_campos_que_no_aplican(client: TestClient) -> None:
    tarjeta = client.post(
        "/cuentas", json={"nombre": "Visa", "tipo": "credito", "dia_corte": 15, "dia_pago": 5}
    ).json()

    actualizada = client.patch(f"/cuentas/{tarjeta['id']}", json={"tipo": "debito"}).json()

    assert actualizada["dia_corte"] is None
    assert actualizada["dia_pago"] is None


def test_campos_de_credito_se_ignoran_en_otros_tipos(client: TestClient) -> None:
    cuenta = client.post(
        "/cuentas", json={"nombre": "Cartera", "tipo": "efectivo", "dia_corte": 10}
    ).json()
    assert cuenta["dia_corte"] is None


def test_calculo_de_rendimiento_compuesto_diario() -> None:
    # 10 000 al 10 % anual durante 30 días ≈ 82.52
    assert servicio.calcular_rendimiento(Decimal("10000"), Decimal("10"), 30) == Decimal("82.52")


@pytest.fixture
def cuenta_rendimientos(client: TestClient) -> dict:
    respuesta = client.post(
        "/cuentas",
        json={"nombre": "Nu", "tipo": "rendimientos", "balance_inicial": "10000",
              "tasa_rendimiento_anual": "10"},
    )
    assert respuesta.status_code == 201
    return respuesta.json()


def test_registrar_rendimientos_crea_ingreso_y_avanza_fecha(
    client: TestClient, session: Session, cuenta_rendimientos: dict
) -> None:
    assert cuenta_rendimientos["fecha_ultimo_rendimiento"] == date.today().isoformat()
    dentro_de_30_dias = date.today() + timedelta(days=30)

    transaccion = servicio.registrar_rendimientos(session, cuenta_rendimientos["id"], hoy=dentro_de_30_dias)

    assert transaccion.monto == Decimal("82.52")
    assert transaccion.tipo == "ingreso"
    # Se creó (o reutilizó) la categoría "Rendimientos"
    categoria = client.get(f"/categorias/{transaccion.categoria_id}").json()
    assert categoria["nombre"] == "Rendimientos"
    # Registrar otra vez el mismo día no duplica el ingreso
    with pytest.raises(ReglaDeNegocioError):
        servicio.registrar_rendimientos(session, cuenta_rendimientos["id"], hoy=dentro_de_30_dias)


def test_rendimientos_el_mismo_dia_de_creacion_devuelve_400(
    client: TestClient, cuenta_rendimientos: dict
) -> None:
    respuesta = client.post(f"/cuentas/{cuenta_rendimientos['id']}/registrar-rendimientos")
    assert respuesta.status_code == 400


def test_cuenta_normal_no_genera_rendimientos(client: TestClient, cuenta: dict) -> None:
    respuesta = client.post(f"/cuentas/{cuenta['id']}/registrar-rendimientos")
    assert respuesta.status_code == 400


# --- Subcuentas (como Revolut) y cuentas fijadas -------------------------------
def _cuenta(client: TestClient, nombre: str, **extra) -> dict:
    respuesta = client.post("/cuentas", json={"nombre": nombre, "tipo": "debito", **extra})
    assert respuesta.status_code == 201, respuesta.json()
    return respuesta.json()


@pytest.mark.usefixtures("tasas")
def test_subcuentas_en_varias_divisas(client: TestClient) -> None:
    revolut = _cuenta(client, "Revolut")
    eur = _cuenta(client, "Revolut EUR", moneda="EUR", cuenta_padre_id=revolut["id"],
                  numero_cuenta="LT12 3456 7890", balance_inicial="100")

    assert eur["cuenta_padre_id"] == revolut["id"]
    assert eur["numero_cuenta"] == "LT12 3456 7890"
    # Cada una con su saldo: el resumen lleva la madre para poder agruparlas.
    saldos = {c["nombre"]: c for c in client.get("/dashboard/resumen").json()["cuentas"]}
    assert saldos["Revolut EUR"]["saldo"] == "100.00"
    assert saldos["Revolut EUR"]["cuenta_padre_id"] == revolut["id"]
    assert saldos["Revolut"]["saldo"] == "0.00"


def test_solo_un_nivel_de_subcuentas(client: TestClient) -> None:
    madre = _cuenta(client, "Revolut")
    hija = _cuenta(client, "Revolut EUR", cuenta_padre_id=madre["id"])

    # Ni subcuenta de una subcuenta...
    assert client.post("/cuentas", json={"nombre": "Nieta", "tipo": "debito", "cuenta_padre_id": hija["id"]}).status_code == 400
    # ...ni una madre puede pasar a ser subcuenta de otra.
    otra = _cuenta(client, "Wise")
    assert client.patch(f"/cuentas/{madre['id']}", json={"cuenta_padre_id": otra["id"]}).status_code == 400
    # Ni de sí misma.
    assert client.patch(f"/cuentas/{otra['id']}", json={"cuenta_padre_id": otra["id"]}).status_code == 400
    # Ni de una cuenta que no existe.
    assert client.patch(f"/cuentas/{otra['id']}", json={"cuenta_padre_id": 999}).status_code == 400


def test_sacar_una_subcuenta_y_borrar_la_madre(client: TestClient) -> None:
    madre = _cuenta(client, "Revolut")
    hija = _cuenta(client, "Revolut EUR", cuenta_padre_id=madre["id"])

    assert client.delete(f"/cuentas/{madre['id']}").status_code == 409

    respuesta = client.patch(f"/cuentas/{hija['id']}", json={"cuenta_padre_id": None})
    assert respuesta.json()["cuenta_padre_id"] is None
    assert client.delete(f"/cuentas/{madre['id']}").status_code == 204


def test_fijar_una_cuenta(client: TestClient) -> None:
    _cuenta(client, "Ahorro")
    bbva = _cuenta(client, "BBVA")
    assert client.patch(f"/cuentas/{bbva['id']}", json={"fijada": True}).json()["fijada"] is True

    saldos = {c["nombre"]: c["fijada"] for c in client.get("/dashboard/resumen").json()["cuentas"]}
    assert saldos == {"Ahorro": False, "BBVA": True}
