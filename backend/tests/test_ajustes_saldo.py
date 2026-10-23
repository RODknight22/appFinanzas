"""Ajustes de saldo: que el saldo cuadre con el del banco sin contar como ingreso ni gasto."""

from datetime import date

from fastapi.testclient import TestClient


def _saldo(client: TestClient, cuenta: dict) -> str:
    cuentas = client.get("/dashboard/resumen").json()["cuentas"]
    return next(c["saldo"] for c in cuentas if c["cuenta_id"] == cuenta["id"])


def _ajustar(client: TestClient, cuenta: dict, saldo_real: str, **extra) -> dict:
    respuesta = client.post(f"/cuentas/{cuenta['id']}/ajustes", json={"saldo_real": saldo_real, **extra})
    assert respuesta.status_code == 201, respuesta.json()
    return respuesta.json()


def test_ajustar_deja_el_saldo_escrito_y_guarda_la_diferencia(client: TestClient, cuenta: dict) -> None:
    ajuste = _ajustar(client, cuenta, "940.50", notas="Cuadre con el banco")
    assert ajuste["diferencia"] == "-59.50"
    assert ajuste["fecha"] == date.today().isoformat()
    assert ajuste["notas"] == "Cuadre con el banco"
    assert _saldo(client, cuenta) == "940.50"

    # Un segundo ajuste parte del saldo ya ajustado.
    assert _ajustar(client, cuenta, "1000")["diferencia"] == "59.50"
    assert _saldo(client, cuenta) == "1000.00"


def test_un_ajuste_no_es_ingreso_ni_gasto(client: TestClient, cuenta: dict) -> None:
    _ajustar(client, cuenta, "700")
    resumen = client.get("/dashboard/resumen").json()
    assert (resumen["ingresos"], resumen["gastos"], resumen["balance_global"]) == ("0.00", "0.00", "700.00")
    assert client.get("/transacciones").json() == []


def test_el_patrimonio_incluye_el_ajuste(client: TestClient, cuenta: dict) -> None:
    _ajustar(client, cuenta, "1250")
    puntos = client.get("/dashboard/patrimonio", params={"meses": 1}).json()
    assert puntos[-1]["total"] == "1250.00"


def test_si_ya_cuadra_no_se_crea_ajuste(client: TestClient, cuenta: dict) -> None:
    respuesta = client.post(f"/cuentas/{cuenta['id']}/ajustes", json={"saldo_real": "1000.00"})
    assert respuesta.status_code == 400
    assert client.get(f"/cuentas/{cuenta['id']}/ajustes").json() == []


def test_listar_y_deshacer_un_ajuste(client: TestClient, cuenta: dict) -> None:
    primero = _ajustar(client, cuenta, "900")
    segundo = _ajustar(client, cuenta, "950")
    ids = [a["id"] for a in client.get(f"/cuentas/{cuenta['id']}/ajustes").json()]
    assert ids == [segundo["id"], primero["id"]]  # el más reciente primero

    assert client.delete(f"/cuentas/{cuenta['id']}/ajustes/{segundo['id']}").status_code == 204
    assert _saldo(client, cuenta) == "900.00"
    # Un ajuste de otra cuenta (o que no existe) no se puede borrar por esta URL.
    otra = client.post("/cuentas", json={"nombre": "Otra", "tipo": "debito"}).json()
    assert client.delete(f"/cuentas/{otra['id']}/ajustes/{primero['id']}").status_code == 404


def test_en_una_tarjeta_el_saldo_real_es_negativo(client: TestClient) -> None:
    tarjeta = client.post("/cuentas", json={"nombre": "Visa", "tipo": "credito", "balance_inicial": "-200", "dia_corte": 5, "dia_pago": 25}).json()
    assert _ajustar(client, tarjeta, "-245.30")["diferencia"] == "-45.30"
    assert _saldo(client, tarjeta) == "-245.30"


def test_ajustes_y_cuenta(client: TestClient, cuenta: dict) -> None:
    _ajustar(client, cuenta, "800")
    # Sus ajustes van en la moneda de la cuenta: cambiarla descuadraría el saldo.
    respuesta = client.patch(f"/cuentas/{cuenta['id']}", json={"moneda": "EUR"})
    assert respuesta.status_code == 409
    assert "ajustes" in respuesta.json()["detail"]
    # Borrar la cuenta se lleva sus ajustes (no son movimientos que haya que conservar).
    assert client.delete(f"/cuentas/{cuenta['id']}").status_code == 204
    assert client.get(f"/cuentas/{cuenta['id']}/ajustes").status_code == 404
