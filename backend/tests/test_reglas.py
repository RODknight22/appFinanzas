"""Reglas de negocio del Paso 1 (cuentas, categorías, transacciones, presupuestos)."""

from fastapi.testclient import TestClient


def test_cuenta_duplicada_devuelve_409(client: TestClient, cuenta: dict) -> None:
    respuesta = client.post("/cuentas", json={"nombre": "Banco", "tipo": "efectivo"})
    assert respuesta.status_code == 409


def test_transaccion_con_tipo_incoherente_devuelve_400(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    respuesta = client.post(
        "/transacciones",
        json={"monto": "10", "tipo": "ingreso", "fecha": "2026-10-01",
              "cuenta_id": cuenta["id"], "categoria_id": categoria_gasto["id"]},
    )
    assert respuesta.status_code == 400


def test_monto_negativo_devuelve_422(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    respuesta = client.post(
        "/transacciones",
        json={"monto": "-5", "tipo": "gasto", "fecha": "2026-10-01",
              "cuenta_id": cuenta["id"], "categoria_id": categoria_gasto["id"]},
    )
    assert respuesta.status_code == 422


def test_no_se_borra_categoria_con_transacciones(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    client.post(
        "/transacciones",
        json={"monto": "10", "tipo": "gasto", "fecha": "2026-10-01",
              "cuenta_id": cuenta["id"], "categoria_id": categoria_gasto["id"]},
    )
    assert client.delete(f"/categorias/{categoria_gasto['id']}").status_code == 409


def test_presupuesto_duplicado_y_mes_invalido(client: TestClient, categoria_gasto: dict) -> None:
    datos = {"categoria_id": categoria_gasto["id"], "monto_limite": "300", "mes_anio": "2026-10"}
    assert client.post("/presupuestos", json=datos).status_code == 201
    assert client.post("/presupuestos", json=datos).status_code == 409
    assert client.post("/presupuestos", json={**datos, "mes_anio": "2026-13"}).status_code == 422


def test_patch_parcial_y_nulo_en_campo_obligatorio(client: TestClient, cuenta: dict) -> None:
    respuesta = client.patch(f"/cuentas/{cuenta['id']}", json={"nombre": "Banco Nuevo"})
    assert respuesta.json()["nombre"] == "Banco Nuevo"
    assert respuesta.json()["tipo"] == "debito"  # lo no enviado no cambia
    assert client.patch(f"/cuentas/{cuenta['id']}", json={"tipo": None}).status_code == 400
