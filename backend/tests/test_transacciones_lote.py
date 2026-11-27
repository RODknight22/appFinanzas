"""Edición en masa: cambiar cuenta o categoría y borrar varias transacciones, todo o nada."""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Moneda, OrigenTasa, TasaCambio
from app.schemas import MAX_IDS_LOTE


def _crear(client: TestClient, cuenta: dict, categoria: dict, monto: str, fecha: str) -> dict:
    respuesta = client.post("/transacciones", json={
        "monto": monto, "tipo": categoria["tipo"], "fecha": fecha, "notas": "importada",
        "categoria_id": categoria["id"], "cuenta_id": cuenta["id"],
    })
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def _todas(client: TestClient) -> dict[int, dict]:
    return {t["id"]: t for t in client.get("/transacciones").json()}


def test_cambia_la_cuenta_a_otra_de_la_misma_moneda(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    otra = client.post("/cuentas", json={"nombre": "Otra", "tipo": "debito"}).json()
    a = _crear(client, cuenta, categoria_gasto, "10.50", "2026-10-01")
    b = _crear(client, cuenta, categoria_gasto, "4.25", "2026-10-02")
    queda = _crear(client, cuenta, categoria_gasto, "1", "2026-10-03")

    respuesta = client.patch("/transacciones/lote", json={"ids": [a["id"], b["id"]], "cuenta_id": otra["id"]})

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() == {"afectadas": 2}
    todas = _todas(client)
    assert [todas[t["id"]]["cuenta_id"] for t in (a, b, queda)] == [otra["id"], otra["id"], cuenta["id"]]
    assert todas[a["id"]]["monto_cuenta"] == "10.50"  # misma moneda: el importe no cambia
    assert todas[a["id"]]["categoria_id"] == categoria_gasto["id"]  # lo no enviado se queda igual


def test_a_una_cuenta_en_otra_moneda_recalcula_con_la_tasa_de_su_fecha(
    client: TestClient, session: Session, tasas: None, categoria_gasto: dict
) -> None:
    client.patch("/configuracion", json={"moneda": "MXN"})
    euros = client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()
    pesos = client.post("/cuentas", json={"nombre": "Banco MX", "tipo": "debito", "moneda": "MXN"}).json()
    # El 2 de octubre el euro estuvo más caro: cada movimiento usa la tasa de su día.
    session.add(TasaCambio(moneda=Moneda.EUR, por_usd=Decimal("0.8"), fecha=date(2026, 10, 2), origen=OrigenTasa.API))
    session.commit()
    uno = _crear(client, euros, categoria_gasto, "90", "2026-10-01")
    dos = _crear(client, euros, categoria_gasto, "80", "2026-10-02")
    assert (uno["monto_principal"], dos["monto_principal"]) == ("1800.00", "1800.00")

    respuesta = client.patch("/transacciones/lote", json={"ids": [uno["id"], dos["id"]], "cuenta_id": pesos["id"]})

    assert respuesta.status_code == 200, respuesta.text
    todas = _todas(client)
    # Igual que al editar una sola: el importe sigue en euros y se convierte a la cuenta y a la principal.
    assert [(todas[t["id"]]["monto"], todas[t["id"]]["moneda"]) for t in (uno, dos)] == [("90.00", "EUR"), ("80.00", "EUR")]
    assert todas[uno["id"]]["monto_cuenta"] == "1800.00"  # 90 / 0.9 * 18
    assert todas[dos["id"]]["monto_cuenta"] == "1800.00"  # 80 / 0.8 * 18
    saldos = {c["cuenta_id"]: c["saldo"] for c in client.get("/dashboard/resumen").json()["cuentas"]}
    assert Decimal(saldos[pesos["id"]]) == Decimal("-3600")
    assert Decimal(saldos[euros["id"]]) == Decimal("0")


def test_cambia_la_categoria(client: TestClient, cuenta: dict, categoria_gasto: dict) -> None:
    super_ = client.post("/categorias", json={"nombre": "Súper", "tipo": "gasto"}).json()
    ids = [_crear(client, cuenta, categoria_gasto, m, "2026-10-01")["id"] for m in ("1", "2", "3")]

    respuesta = client.patch("/transacciones/lote", json={"ids": ids, "categoria_id": super_["id"]})

    assert respuesta.status_code == 200, respuesta.text
    assert {t["categoria_id"] for t in _todas(client).values()} == {super_["id"]}


def test_una_categoria_incompatible_no_cambia_nada(
    client: TestClient, session: Session, cuenta: dict, categoria_gasto: dict, categoria_ingreso: dict
) -> None:
    gasto = _crear(client, cuenta, categoria_gasto, "10", "2026-10-01")
    ingreso = _crear(client, cuenta, categoria_ingreso, "100", "2026-10-02")
    otro_gasto = client.post("/categorias", json={"nombre": "Ocio", "tipo": "gasto"}).json()

    # El primero sí podría cambiar, pero el ingreso no admite una categoría de gasto.
    respuesta = client.patch(
        "/transacciones/lote", json={"ids": [gasto["id"], ingreso["id"]], "categoria_id": otro_gasto["id"]}
    )

    assert respuesta.status_code == 400
    assert "es de gasto" in respuesta.json()["detail"]
    session.rollback()  # en la app lo hace el cierre de la sesión de la petición
    todas = _todas(client)
    assert todas[gasto["id"]]["categoria_id"] == categoria_gasto["id"]
    assert todas[ingreso["id"]]["categoria_id"] == categoria_ingreso["id"]


def test_ids_inexistentes_dan_404_sin_cambios_parciales(
    client: TestClient, session: Session, cuenta: dict, categoria_gasto: dict
) -> None:
    otra = client.post("/cuentas", json={"nombre": "Otra", "tipo": "debito"}).json()
    existe = _crear(client, cuenta, categoria_gasto, "10", "2026-10-01")

    cambio = client.patch("/transacciones/lote", json={"ids": [existe["id"], 9999], "cuenta_id": otra["id"]})
    borrado = client.request("DELETE", "/transacciones/lote", json={"ids": [existe["id"], 9999]})

    assert (cambio.status_code, borrado.status_code) == (404, 404)
    assert "9999" in cambio.json()["detail"]
    session.rollback()
    assert _todas(client)[existe["id"]]["cuenta_id"] == cuenta["id"]


def test_cuenta_inexistente_no_cambia_nada(client: TestClient, cuenta: dict, categoria_gasto: dict) -> None:
    t = _crear(client, cuenta, categoria_gasto, "10", "2026-10-01")
    respuesta = client.patch("/transacciones/lote", json={"ids": [t["id"]], "cuenta_id": 9999})
    assert respuesta.status_code == 400
    assert _todas(client)[t["id"]]["cuenta_id"] == cuenta["id"]


def test_borra_en_lote(client: TestClient, cuenta: dict, categoria_gasto: dict) -> None:
    ids = [_crear(client, cuenta, categoria_gasto, m, "2026-10-01")["id"] for m in ("1", "2", "3")]

    # Un id repetido cuenta una vez.
    respuesta = client.request("DELETE", "/transacciones/lote", json={"ids": [ids[0], ids[1], ids[0]]})

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() == {"afectadas": 2}
    assert list(_todas(client)) == [ids[2]]


def test_las_comisiones_de_transferencias_se_rechazan(
    client: TestClient, session: Session, cuenta: dict, categoria_gasto: dict
) -> None:
    otra = client.post("/cuentas", json={"nombre": "Otra", "tipo": "debito"}).json()
    client.post("/transferencias", json={
        "cuenta_origen_id": cuenta["id"], "cuenta_destino_id": otra["id"], "monto_origen": "100",
        "comision": "2", "fecha": "2026-10-01",
    })
    normal = _crear(client, cuenta, categoria_gasto, "10", "2026-10-01")
    ids = list(_todas(client))
    assert len(ids) == 2  # la normal y la comisión

    respuesta = client.request("DELETE", "/transacciones/lote", json={"ids": ids})

    assert respuesta.status_code == 409
    assert "comisiones" in respuesta.json()["detail"]
    session.rollback()
    assert normal["id"] in _todas(client) and len(_todas(client)) == 2


@pytest.mark.parametrize("cuerpo", [
    {"ids": []},
    {"ids": list(range(1, MAX_IDS_LOTE + 2))},
])
def test_limites_de_la_peticion(client: TestClient, cuerpo: dict) -> None:
    assert client.patch("/transacciones/lote", json={**cuerpo, "cuenta_id": 1}).status_code == 422
    assert client.request("DELETE", "/transacciones/lote", json=cuerpo).status_code == 422


def test_sin_nada_que_cambiar(client: TestClient, cuenta: dict, categoria_gasto: dict) -> None:
    t = _crear(client, cuenta, categoria_gasto, "10", "2026-10-01")
    respuesta = client.patch("/transacciones/lote", json={"ids": [t["id"]]})
    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == "Indica la cuenta o la categoría nueva"
