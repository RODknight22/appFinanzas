"""Búsqueda y filtros de transacciones con paginación y totales."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def movimientos(client: TestClient, cuenta: dict, categoria_gasto: dict, categoria_ingreso: dict) -> dict:
    """Comida (gasto) y Sueldo (ingreso) en la cuenta "Banco", más uno en "Cartera"."""
    cartera = client.post("/cuentas", json={"nombre": "Cartera", "tipo": "efectivo"}).json()
    educacion = client.post("/categorias", json={"nombre": "Educación", "tipo": "gasto"}).json()

    def anotar(monto: str, categoria: dict, fecha: str, notas: str | None = None, cuenta_id: int = cuenta["id"]) -> None:
        client.post("/transacciones", json={
            "monto": monto, "tipo": categoria["tipo"], "fecha": fecha, "notas": notas,
            "categoria_id": categoria["id"], "cuenta_id": cuenta_id,
        })

    anotar("50", categoria_gasto, "2026-09-10", "Tacos al pastor")
    anotar("120", categoria_gasto, "2026-10-02", "Súper Mercadona")
    anotar("2000", categoria_ingreso, "2026-10-01", "Nómina")
    anotar("399", educacion, "2026-10-05", "Curso de Python", cuenta_id=cartera["id"])
    return {"cartera": cartera, "educacion": educacion}


def _buscar(client: TestClient, **filtros) -> dict:
    respuesta = client.get("/transacciones/buscar", params=filtros)
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def test_sin_filtros_devuelve_todo_con_totales(client: TestClient, movimientos: dict) -> None:
    pagina = _buscar(client)
    assert pagina["total"] == 4
    assert (pagina["total_ingresos"], pagina["total_gastos"]) == ("2000.00", "569.00")


@pytest.mark.parametrize(
    ("texto", "esperados"),
    [
        ("tacos", ["50.00"]),  # en las notas, sin importar mayúsculas
        ("SUPER", ["120.00"]),  # "Súper": sin importar tildes
        ("educacion", ["399.00"]),  # por el nombre de la categoría, sin tilde
        ("comida", ["120.00", "50.00"]),
        ("nada que ver", []),
    ],
)
def test_busqueda_por_texto(client: TestClient, movimientos: dict, texto: str, esperados: list[str]) -> None:
    assert [t["monto"] for t in _buscar(client, texto=texto)["items"]] == esperados


def test_filtros_combinados(client: TestClient, movimientos: dict, cuenta: dict) -> None:
    assert _buscar(client, cuenta_id=movimientos["cartera"]["id"])["total"] == 1
    assert _buscar(client, categoria_id=movimientos["educacion"]["id"])["total"] == 1
    assert _buscar(client, tipo="gasto", desde="2026-10-01", hasta="2026-10-31")["total"] == 2
    assert _buscar(client, monto_min="100", monto_max="400")["total"] == 2
    pagina = _buscar(client, cuenta_id=cuenta["id"], tipo="gasto", texto="super")
    assert [t["notas"] for t in pagina["items"]] == ["Súper Mercadona"]
    assert pagina["total_gastos"] == "120.00"


def test_paginacion_mantiene_los_totales(client: TestClient, movimientos: dict) -> None:
    primera = _buscar(client, limit=3)
    segunda = _buscar(client, limit=3, offset=3)

    assert len(primera["items"]) == 3 and len(segunda["items"]) == 1
    assert primera["total"] == segunda["total"] == 4
    assert primera["total_gastos"] == segunda["total_gastos"]
    # La más reciente primero, sin repetir ninguna entre páginas.
    assert primera["items"][0]["fecha"] == "2026-10-05"
    ids = [t["id"] for t in primera["items"] + segunda["items"]]
    assert len(set(ids)) == 4


def test_la_lista_simple_acepta_los_mismos_filtros(client: TestClient, movimientos: dict) -> None:
    assert len(client.get("/transacciones", params={"texto": "nomina"}).json()) == 1


def test_importe_negativo_es_422(client: TestClient) -> None:
    assert client.get("/transacciones/buscar", params={"monto_min": "-1"}).status_code == 422


def test_comodines_se_buscan_literalmente(client: TestClient, movimientos: dict) -> None:
    assert _buscar(client, texto="%")["total"] == 0
    assert _buscar(client, texto="_")["total"] == 0
