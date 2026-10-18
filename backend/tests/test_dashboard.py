import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def movimientos(
    client: TestClient, cuenta: dict, categoria_gasto: dict, categoria_ingreso: dict
) -> None:
    """Escenario: sueldo de 2000 en octubre, gastos de 0.10 + 0.20 + 300 y uno en septiembre."""
    base = {"cuenta_id": cuenta["id"]}
    transacciones = [
        {"monto": "2000", "tipo": "ingreso", "fecha": "2026-10-01", "categoria_id": categoria_ingreso["id"]},
        {"monto": "0.10", "tipo": "gasto", "fecha": "2026-10-05", "categoria_id": categoria_gasto["id"]},
        {"monto": "0.20", "tipo": "gasto", "fecha": "2026-10-06", "categoria_id": categoria_gasto["id"]},
        {"monto": "300", "tipo": "gasto", "fecha": "2026-10-31", "categoria_id": categoria_gasto["id"]},
        {"monto": "50", "tipo": "gasto", "fecha": "2026-09-30", "categoria_id": categoria_gasto["id"]},
    ]
    for datos in transacciones:
        assert client.post("/transacciones", json={**base, **datos}).status_code == 201


@pytest.mark.usefixtures("movimientos")
def test_resumen_del_mes(client: TestClient) -> None:
    resumen = client.get("/dashboard/resumen", params={"mes_anio": "2026-10"}).json()

    assert resumen["ingresos"] == "2000.00"
    assert resumen["gastos"] == "300.30"  # sin errores de redondeo de float
    assert resumen["flujo_neto"] == "1699.70"
    # 1000 inicial + 2000 - 300.30 - 50 (septiembre también cuenta en el balance)
    assert resumen["balance_global"] == "2649.70"
    assert resumen["cuentas"][0]["saldo"] == "2649.70"


@pytest.mark.usefixtures("movimientos")
def test_flujo_mensual_rellena_meses_vacios(client: TestClient) -> None:
    flujo = client.get(
        "/dashboard/flujo-mensual", params={"hasta_mes": "2026-11", "meses": 3}
    ).json()

    assert [m["mes_anio"] for m in flujo] == ["2026-09", "2026-10", "2026-11"]
    assert flujo[0]["gastos"] == "50.00"
    assert flujo[1]["ingresos"] == "2000.00"
    assert flujo[2]["gastos"] == "0.00"


@pytest.mark.usefixtures("movimientos")
def test_gastos_por_categoria(client: TestClient) -> None:
    gastos = client.get("/dashboard/gastos-por-categoria", params={"mes_anio": "2026-10"}).json()

    assert len(gastos) == 1
    assert gastos[0]["nombre"] == "Comida"
    assert gastos[0]["total"] == "300.30"
    assert gastos[0]["porcentaje"] == 100.0


@pytest.mark.usefixtures("movimientos")
def test_progreso_presupuesto_excedido(client: TestClient, categoria_gasto: dict) -> None:
    client.post(
        "/presupuestos",
        json={"categoria_id": categoria_gasto["id"], "monto_limite": "250", "mes_anio": "2026-10"},
    )

    progreso = client.get("/dashboard/presupuestos", params={"mes_anio": "2026-10"}).json()

    assert progreso[0]["gastado"] == "300.30"
    assert progreso[0]["restante"] == "-50.30"
    assert progreso[0]["porcentaje"] == 120.1
    assert progreso[0]["excedido"] is True


def test_dashboard_vacio_no_falla(client: TestClient) -> None:
    resumen = client.get("/dashboard/resumen").json()
    assert resumen["balance_global"] == "0.00"
    assert client.get("/dashboard/gastos-por-categoria").json() == []
