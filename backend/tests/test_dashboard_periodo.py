"""Periodo del dashboard (desde/hasta) y los widgets que dependen de él.

Moneda principal: MXN. Tasas de ejemplo (conftest.py): 1 EUR = 18 / 0.9 = 20 MXN.
"""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.services import dashboard as servicio


def _anotar(
    client: TestClient, cuenta: dict, categoria: dict, monto: str, fecha: str,
    notas: str | None = None, moneda: str | None = None,
) -> None:
    datos = {"monto": monto, "tipo": categoria["tipo"], "fecha": fecha,
             "categoria_id": categoria["id"], "cuenta_id": cuenta["id"], "notas": notas}
    if moneda:
        datos["moneda"] = moneda
    respuesta = client.post("/transacciones", json=datos)
    assert respuesta.status_code == 201, respuesta.json()


@pytest.fixture
def revolut(client: TestClient, tasas: None) -> dict:
    """Cuenta en euros: sus gastos se suman al dashboard convertidos a pesos."""
    return client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()


# ---------------------------------------------------------------------------
# Parámetro de periodo
# ---------------------------------------------------------------------------
def test_resumen_con_rango_incluye_los_dos_extremos(
    client: TestClient, cuenta: dict, categoria_gasto: dict, categoria_ingreso: dict
) -> None:
    _anotar(client, cuenta, categoria_gasto, "10.10", "2026-10-09")  # el día antes: fuera
    _anotar(client, cuenta, categoria_gasto, "20.20", "2026-10-10")  # desde
    _anotar(client, cuenta, categoria_ingreso, "500", "2026-10-12")
    _anotar(client, cuenta, categoria_gasto, "30.30", "2026-10-16")  # hasta
    _anotar(client, cuenta, categoria_gasto, "40.40", "2026-10-17")  # el día después: fuera

    resumen = client.get("/dashboard/resumen", params={"desde": "2026-10-10", "hasta": "2026-10-16"}).json()

    assert resumen["gastos"] == "50.50"
    assert resumen["ingresos"] == "500.00"
    assert resumen["flujo_neto"] == "449.50"
    assert (resumen["desde"], resumen["hasta"]) == ("2026-10-10", "2026-10-16")
    # El balance no depende del periodo: 1000 + 500 - todos los gastos.
    assert resumen["balance_global"] == "1399.00"


def test_sin_rango_sigue_siendo_el_mes(client: TestClient, cuenta: dict, categoria_gasto: dict) -> None:
    _anotar(client, cuenta, categoria_gasto, "15", "2026-10-31")
    _anotar(client, cuenta, categoria_gasto, "99", "2026-11-01")

    resumen = client.get("/dashboard/resumen", params={"mes_anio": "2026-10"}).json()

    assert resumen["gastos"] == "15.00"
    assert (resumen["desde"], resumen["hasta"]) == ("2026-10-01", "2026-10-31")


def test_gastos_por_categoria_con_rango(client: TestClient, cuenta: dict, categoria_gasto: dict) -> None:
    _anotar(client, cuenta, categoria_gasto, "12.34", "2026-09-30")
    _anotar(client, cuenta, categoria_gasto, "1.11", "2026-10-02")

    gastos = client.get("/dashboard/gastos-por-categoria", params={"desde": "2026-09-28", "hasta": "2026-10-04"}).json()

    assert [(g["nombre"], g["total"]) for g in gastos] == [("Comida", "13.45")]


@pytest.mark.parametrize(
    ("parametros", "mensaje"),
    [
        ({"desde": "2026-10-01"}, "las dos fechas"),
        ({"desde": "2026-10-05", "hasta": "2026-10-01"}, "posterior"),
        ({"desde": "2020-01-01", "hasta": "2026-10-01"}, "tres años"),
    ],
)
def test_rango_no_valido(client: TestClient, parametros: dict, mensaje: str) -> None:
    respuesta = client.get("/dashboard/resumen", params=parametros)
    assert respuesta.status_code == 400
    assert mensaje in respuesta.json()["detail"]


# ---------------------------------------------------------------------------
# Comparativa con el periodo anterior
# ---------------------------------------------------------------------------
def test_comparativa_del_mes_con_el_anterior(
    client: TestClient, cuenta: dict, revolut: dict, categoria_gasto: dict, categoria_ingreso: dict
) -> None:
    _anotar(client, cuenta, categoria_ingreso, "1000", "2026-09-01")
    _anotar(client, cuenta, categoria_gasto, "200", "2026-09-15")
    _anotar(client, cuenta, categoria_ingreso, "1000", "2026-10-01")
    _anotar(client, revolut, categoria_gasto, "12.50", "2026-10-15")  # 250 MXN

    comparativa = client.get("/dashboard/comparativa", params={"mes_anio": "2026-10"}).json()

    assert comparativa["actual"]["gastos"] == "250.00"
    assert comparativa["anterior"]["gastos"] == "200.00"
    assert (comparativa["anterior"]["desde"], comparativa["anterior"]["hasta"]) == ("2026-09-01", "2026-09-30")
    assert comparativa["variacion_gastos"] == 25.0
    assert comparativa["variacion_ingresos"] == 0.0


def test_comparativa_de_un_rango_con_los_mismos_dias_antes(
    client: TestClient, cuenta: dict, categoria_gasto: dict, categoria_ingreso: dict
) -> None:
    _anotar(client, cuenta, categoria_gasto, "40", "2026-10-03")  # periodo anterior: 3-9
    _anotar(client, cuenta, categoria_gasto, "10", "2026-10-10")  # periodo: 10-16
    _anotar(client, cuenta, categoria_ingreso, "80", "2026-10-16")

    comparativa = client.get("/dashboard/comparativa", params={"desde": "2026-10-10", "hasta": "2026-10-16"}).json()

    assert (comparativa["anterior"]["desde"], comparativa["anterior"]["hasta"]) == ("2026-10-03", "2026-10-09")
    assert comparativa["anterior"]["gastos"] == "40.00"
    assert comparativa["variacion_gastos"] == -75.0
    # Sin ingresos antes, no hay porcentaje que dar.
    assert comparativa["variacion_ingresos"] is None


def test_las_transferencias_no_son_gasto_pero_su_comision_si(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    ahorro = client.post("/cuentas", json={"nombre": "Ahorro", "tipo": "debito"}).json()
    _anotar(client, cuenta, categoria_gasto, "30", "2026-10-05", notas="Mercadona")
    respuesta = client.post("/transferencias", json={
        "cuenta_origen_id": cuenta["id"], "cuenta_destino_id": ahorro["id"],
        "monto_origen": "400", "comision": "2.50", "fecha": "2026-10-06",
    })
    assert respuesta.status_code == 201
    rango = {"desde": "2026-10-01", "hasta": "2026-10-31"}

    comparativa = client.get("/dashboard/comparativa", params=rango).json()
    por_cuenta = client.get("/dashboard/gastos-por-cuenta", params=rango).json()

    assert comparativa["actual"]["gastos"] == "32.50"  # 30 + la comisión; los 400 no
    assert comparativa["actual"]["ingresos"] == "0.00"  # lo que llega a Ahorro tampoco
    assert [(g["nombre"], g["total"]) for g in por_cuenta] == [("Banco", "32.50")]


# ---------------------------------------------------------------------------
# Top comercios
# ---------------------------------------------------------------------------
def test_top_comercios_agrupa_variantes_y_convierte(
    client: TestClient, cuenta: dict, revolut: dict, categoria_gasto: dict, categoria_ingreso: dict
) -> None:
    _anotar(client, cuenta, categoria_gasto, "100.10", "2026-10-02", notas="COMPRA TARJ. 1234 MERCADONA 02/10")
    _anotar(client, cuenta, categoria_gasto, "50.05", "2026-10-03", notas="Mercadona")
    _anotar(client, revolut, categoria_gasto, "10", "2026-10-04", notas="Café Central")  # 200 MXN
    _anotar(client, cuenta, categoria_gasto, "20", "2026-10-05", notas="cafe central")
    _anotar(client, cuenta, categoria_gasto, "29.85", "2026-10-06")  # sin descripción: fuera de la lista
    _anotar(client, cuenta, categoria_ingreso, "999", "2026-10-07", notas="Mercadona")  # ingreso: no cuenta
    _anotar(client, cuenta, categoria_gasto, "500", "2026-11-01", notas="Mercadona")  # otro mes

    top = client.get("/dashboard/top-comercios", params={"mes_anio": "2026-10"}).json()

    assert [(c["nombre"], c["total"], c["movimientos"]) for c in top] == [
        ("Café Central", "220.00", 2),
        ("Mercadona", "150.15", 2),
    ]
    # Sobre todo el gasto del mes: 400 (también los 29.85 sin descripción).
    assert [c["porcentaje"] for c in top] == [55.0, 37.5]


def test_top_comercios_respeta_el_limite(client: TestClient, cuenta: dict, categoria_gasto: dict) -> None:
    for i, nombre in enumerate(["Uno", "Dos", "Tres"], start=1):
        _anotar(client, cuenta, categoria_gasto, str(i), "2026-10-10", notas=nombre)

    top = client.get("/dashboard/top-comercios", params={"mes_anio": "2026-10", "limite": 2}).json()

    assert [c["nombre"] for c in top] == ["Tres", "Dos"]


def test_top_comercios_vacio(client: TestClient) -> None:
    assert client.get("/dashboard/top-comercios").json() == []


# ---------------------------------------------------------------------------
# Gasto por cuenta
# ---------------------------------------------------------------------------
def test_gasto_por_cuenta_en_la_principal_y_en_su_moneda(
    client: TestClient, cuenta: dict, revolut: dict, categoria_gasto: dict
) -> None:
    _anotar(client, revolut, categoria_gasto, "30", "2026-10-03")  # 600 MXN
    _anotar(client, revolut, categoria_gasto, "200", "2026-10-04", moneda="MXN")  # 10 EUR de la cuenta
    _anotar(client, cuenta, categoria_gasto, "200", "2026-10-05")
    _anotar(client, cuenta, categoria_gasto, "77", "2026-09-30")  # fuera del periodo

    por_cuenta = client.get("/dashboard/gastos-por-cuenta", params={"desde": "2026-10-01", "hasta": "2026-10-31"}).json()

    assert [(g["nombre"], g["moneda"], g["total"], g["total_cuenta"], g["porcentaje"]) for g in por_cuenta] == [
        ("Revolut", "EUR", "800.00", "40.00", 80.0),
        ("Banco", "MXN", "200.00", "200.00", 20.0),
    ]


# ---------------------------------------------------------------------------
# Ahorro del año
# ---------------------------------------------------------------------------
def test_ahorro_anual_acumula_mes_a_mes_y_corta_en_hoy(
    client: TestClient, session: Session, cuenta: dict, revolut: dict, categoria_gasto: dict, categoria_ingreso: dict
) -> None:
    _anotar(client, cuenta, categoria_ingreso, "999", "2025-12-31")  # otro año
    _anotar(client, cuenta, categoria_ingreso, "1000.10", "2026-01-15")
    _anotar(client, cuenta, categoria_gasto, "300.05", "2026-01-20")
    _anotar(client, revolut, categoria_gasto, "25", "2026-02-10")  # 500 MXN
    _anotar(client, cuenta, categoria_ingreso, "100", "2026-03-01")
    _anotar(client, cuenta, categoria_gasto, "50", "2026-04-02")  # después de "hoy"

    ahorro = servicio.ahorro_anual(session, 2026, hoy=date(2026, 3, 20))

    assert [(m.mes_anio, str(m.ahorro), str(m.acumulado)) for m in ahorro.meses] == [
        ("2026-01", "700.05", "700.05"),
        ("2026-02", "-500.00", "200.05"),
        ("2026-03", "100.00", "300.05"),
    ]
    assert (str(ahorro.ingresos), str(ahorro.gastos), str(ahorro.ahorro)) == ("1100.10", "800.05", "300.05")


def test_ahorro_anual_de_un_anio_pasado_tiene_doce_meses(client: TestClient) -> None:
    ahorro = client.get("/dashboard/ahorro-anual", params={"anio": 2025}).json()

    assert len(ahorro["meses"]) == 12
    assert ahorro["ahorro"] == "0.00"


def test_ahorro_anual_de_un_anio_futuro_esta_vacio(session: Session) -> None:
    ahorro = servicio.ahorro_anual(session, 2030, hoy=date(2026, 3, 20))
    assert ahorro.meses == []


def test_comparativa_del_mes_en_curso_usa_los_mismos_dias(
    client: TestClient, session: Session, cuenta: dict, categoria_gasto: dict
) -> None:
    _anotar(client, cuenta, categoria_gasto, "10", "2026-10-05")  # mismos días del anterior
    _anotar(client, cuenta, categoria_gasto, "900", "2026-10-20")  # resto de octubre: no cuenta
    _anotar(client, cuenta, categoria_gasto, "15", "2026-11-05")  # hoy
    _anotar(client, cuenta, categoria_gasto, "70", "2026-11-06")  # después de hoy: no cuenta

    periodo = servicio.periodo_del_mes(session, "2026-11")
    comparativa = servicio.comparativa(session, periodo, hoy=date(2026, 11, 5))

    assert comparativa.en_curso is True
    assert (comparativa.actual.desde, comparativa.actual.hasta) == (date(2026, 11, 1), date(2026, 11, 5))
    assert (comparativa.anterior.desde, comparativa.anterior.hasta) == (date(2026, 10, 1), date(2026, 10, 5))
    assert (str(comparativa.actual.gastos), str(comparativa.anterior.gastos)) == ("15.00", "10.00")
    assert comparativa.variacion_gastos == 50.0


def test_comparativa_en_curso_recorta_al_fin_de_un_mes_corto(
    client: TestClient, session: Session, cuenta: dict, categoria_gasto: dict
) -> None:
    _anotar(client, cuenta, categoria_gasto, "28", "2026-02-28")
    _anotar(client, cuenta, categoria_gasto, "31", "2026-03-31")

    periodo = servicio.periodo_del_mes(session, "2026-03")
    comparativa = servicio.comparativa(session, periodo, hoy=date(2026, 3, 31))

    # 31 días de marzo frente a todo febrero (28), sin pasar a marzo.
    assert (comparativa.anterior.desde, comparativa.anterior.hasta) == (date(2026, 2, 1), date(2026, 2, 28))
    assert (str(comparativa.actual.gastos), str(comparativa.anterior.gastos)) == ("31.00", "28.00")


def test_comparativa_de_un_mes_pasado_compara_meses_completos(
    client: TestClient, session: Session, cuenta: dict, categoria_gasto: dict
) -> None:
    _anotar(client, cuenta, categoria_gasto, "40", "2026-09-30")
    _anotar(client, cuenta, categoria_gasto, "20", "2026-10-31")

    periodo = servicio.periodo_del_mes(session, "2026-10")
    comparativa = servicio.comparativa(session, periodo, hoy=date(2026, 11, 5))

    assert comparativa.en_curso is False
    assert (comparativa.actual.desde, comparativa.actual.hasta) == (date(2026, 10, 1), date(2026, 10, 31))
    assert (comparativa.anterior.desde, comparativa.anterior.hasta) == (date(2026, 9, 1), date(2026, 9, 30))
    assert comparativa.variacion_gastos == -50.0
