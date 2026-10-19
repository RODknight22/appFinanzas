"""Datos de las gráficas del dashboard: patrimonio mensual y gastos diarios."""

from datetime import date

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.services import dashboard as servicio


def _anotar(client: TestClient, cuenta: dict, categoria: dict, monto: str, fecha: str) -> None:
    client.post("/transacciones", json={
        "monto": monto, "tipo": categoria["tipo"], "fecha": fecha,
        "categoria_id": categoria["id"], "cuenta_id": cuenta["id"],
    })


def test_patrimonio_al_cierre_de_cada_mes(
    client: TestClient, session: Session, cuenta: dict, categoria_gasto: dict, categoria_ingreso: dict
) -> None:
    # La cuenta "Banco" empieza con 1000.
    _anotar(client, cuenta, categoria_gasto, "100", "2026-09-10")
    _anotar(client, cuenta, categoria_ingreso, "50", "2026-10-05")
    _anotar(client, cuenta, categoria_gasto, "30", "2026-10-25")  # después de "hoy"

    puntos = servicio.patrimonio(session, "2026-10", 3, hoy=date(2026, 10, 19))

    assert [(p.mes_anio, str(p.total)) for p in puntos] == [
        ("2026-08", "1000.00"),
        ("2026-09", "900.00"),
        ("2026-10", "950.00"),  # el mes en curso, solo hasta hoy
    ]


def test_las_transferencias_no_cambian_el_patrimonio(client: TestClient, session: Session, cuenta: dict) -> None:
    ahorro = client.post("/cuentas", json={"nombre": "Ahorro", "tipo": "debito"}).json()
    client.post("/transferencias", json={
        "cuenta_origen_id": cuenta["id"], "cuenta_destino_id": ahorro["id"],
        "monto_origen": "400", "fecha": "2026-09-15",
    })
    puntos = servicio.patrimonio(session, "2026-10", 2, hoy=date(2026, 10, 19))
    assert {str(p.total) for p in puntos} == {"1000.00"}


def test_patrimonio_acumula_mes_a_mes_con_transferencia_y_futuro(
    client: TestClient, session: Session, cuenta: dict, categoria_gasto: dict, categoria_ingreso: dict
) -> None:
    ahorro = client.post("/cuentas", json={"nombre": "Ahorro", "tipo": "debito"}).json()
    _anotar(client, cuenta, categoria_gasto, "10", "2026-06-01")  # antes de la ventana
    _anotar(client, cuenta, categoria_gasto, "100", "2026-08-20")
    _anotar(client, cuenta, categoria_ingreso, "200", "2026-09-03")
    client.post("/transferencias", json={
        "cuenta_origen_id": cuenta["id"], "cuenta_destino_id": ahorro["id"],
        "monto_origen": "400", "fecha": "2026-09-15",
    })
    _anotar(client, cuenta, categoria_ingreso, "50", "2026-10-05")
    _anotar(client, cuenta, categoria_gasto, "30", "2026-10-25")  # futuro: no cuenta

    puntos = servicio.patrimonio(session, "2026-10", 3, hoy=date(2026, 10, 19))

    assert [(p.mes_anio, str(p.total)) for p in puntos] == [
        ("2026-08", "890.00"),   # 1000 - 10 - 100
        ("2026-09", "1090.00"),  # + 200 (la transferencia no cambia el total)
        ("2026-10", "1140.00"),  # + 50
    ]


def test_patrimonio_respeta_el_dia_de_inicio_de_mes(
    client: TestClient, session: Session, cuenta: dict, categoria_gasto: dict, categoria_ingreso: dict
) -> None:
    client.patch("/configuracion", json={"dia_inicio_mes": 15})
    _anotar(client, cuenta, categoria_gasto, "100", "2026-09-14")  # aún mes financiero 2026-08
    _anotar(client, cuenta, categoria_ingreso, "50", "2026-09-15")  # 2026-09
    _anotar(client, cuenta, categoria_gasto, "20", "2026-10-14")  # 2026-09
    _anotar(client, cuenta, categoria_ingreso, "7", "2026-10-15")  # 2026-10

    puntos = servicio.patrimonio(session, "2026-10", 3, hoy=date(2026, 10, 19))

    assert [(p.mes_anio, str(p.total)) for p in puntos] == [
        ("2026-08", "900.00"),
        ("2026-09", "930.00"),
        ("2026-10", "937.00"),
    ]


def test_patrimonio_convierte_otras_monedas(client: TestClient, session: Session, tasas: None) -> None:
    client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR", "balance_inicial": "90"})
    # 90 EUR = 100 USD = 1800 MXN con las tasas de ejemplo.
    assert str(servicio.patrimonio(session, "2026-10", 1)[0].total) == "1800.00"


def test_gastos_diarios_del_mes(client: TestClient, cuenta: dict, categoria_gasto: dict, categoria_ingreso: dict) -> None:
    _anotar(client, cuenta, categoria_gasto, "10", "2026-10-03")
    _anotar(client, cuenta, categoria_gasto, "15", "2026-10-03")
    _anotar(client, cuenta, categoria_gasto, "7", "2026-10-20")
    _anotar(client, cuenta, categoria_ingreso, "999", "2026-10-03")  # los ingresos no cuentan
    _anotar(client, cuenta, categoria_gasto, "5", "2026-09-30")  # otro mes

    dias = client.get("/dashboard/gastos-diarios", params={"mes_anio": "2026-10"}).json()

    assert dias == [{"fecha": "2026-10-03", "total": "25.00"}, {"fecha": "2026-10-20", "total": "7.00"}]


def test_endpoint_patrimonio(client: TestClient, cuenta: dict) -> None:
    respuesta = client.get("/dashboard/patrimonio", params={"hasta_mes": "2026-10", "meses": 4})
    assert respuesta.status_code == 200 and len(respuesta.json()) == 4
