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
