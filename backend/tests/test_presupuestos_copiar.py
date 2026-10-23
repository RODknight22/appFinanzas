"""Repetir los presupuestos: copiar los del último mes que los tiene."""

from fastapi.testclient import TestClient


def _presupuesto(client: TestClient, categoria_id: int, mes: str, limite: str, moneda: str | None = None) -> None:
    datos = {"categoria_id": categoria_id, "mes_anio": mes, "monto_limite": limite}
    if moneda:
        datos["moneda"] = moneda
    assert client.post("/presupuestos", json=datos).status_code == 201


def _gasto(client: TestClient, nombre: str) -> int:
    return client.post("/categorias", json={"nombre": nombre, "tipo": "gasto"}).json()["id"]


def _del_mes(client: TestClient, mes: str) -> dict[int, tuple[str, str]]:
    return {p["categoria_id"]: (p["monto_limite"], p["moneda"]) for p in client.get("/presupuestos", params={"mes_anio": mes}).json()}


def test_copia_los_que_faltan_del_ultimo_mes_con_presupuestos(client: TestClient) -> None:
    comida, ocio, casa = _gasto(client, "Comida"), _gasto(client, "Ocio"), _gasto(client, "Casa")
    _presupuesto(client, comida, "2026-07", "100")  # más antiguo: no se usa
    _presupuesto(client, comida, "2026-08", "300")
    _presupuesto(client, ocio, "2026-08", "80", "EUR")
    # Septiembre se quedó sin presupuestos; en octubre ya hay uno de Comida, que no se pisa.
    _presupuesto(client, comida, "2026-10", "250")

    assert client.get("/presupuestos/copiables", params={"mes_anio": "2026-10"}).json() == {"desde": "2026-08", "cantidad": 1}
    respuesta = client.post("/presupuestos/copiar", params={"mes_anio": "2026-10"})
    assert respuesta.status_code == 201
    assert respuesta.json() == {"desde": "2026-08", "cantidad": 1}
    assert _del_mes(client, "2026-10") == {comida: ("250.00", "MXN"), ocio: ("80.00", "EUR")}
    assert casa not in _del_mes(client, "2026-10")

    # Copiar otra vez no duplica nada.
    assert client.post("/presupuestos/copiar", params={"mes_anio": "2026-10"}).json()["cantidad"] == 0


def test_sin_meses_anteriores_no_hay_nada_que_copiar(client: TestClient) -> None:
    _presupuesto(client, _gasto(client, "Comida"), "2026-10", "100")
    assert client.get("/presupuestos/copiables", params={"mes_anio": "2026-10"}).json() == {"desde": None, "cantidad": 0}
    assert client.post("/presupuestos/copiar", params={"mes_anio": "2026-09"}).json() == {"desde": None, "cantidad": 0}
    assert client.get("/presupuestos/copiables", params={"mes_anio": "octubre"}).status_code == 422
