"""Deudas: préstamos que haces o te hacen, sus abonos y su efecto en los saldos."""

from fastapi.testclient import TestClient


def _saldo(client: TestClient, cuenta: dict) -> str:
    cuentas = client.get("/dashboard/resumen").json()["cuentas"]
    return next(c["saldo"] for c in cuentas if c["cuenta_id"] == cuenta["id"])


def _deuda(client: TestClient, **datos) -> dict:
    respuesta = client.post("/deudas", json={"persona": "Ana", "fecha": "2026-10-01", **datos})
    assert respuesta.status_code == 201, respuesta.json()
    return respuesta.json()


def test_no_se_cambia_la_moneda_de_una_cuenta_con_deudas(client: TestClient, cuenta: dict) -> None:
    # El saldo de la cuenta mezclaría el préstamo en la moneda vieja con la nueva.
    _deuda(client, sentido="me_deben", monto="300", cuenta_id=cuenta["id"])
    respuesta = client.patch(f"/cuentas/{cuenta['id']}", json={"moneda": "EUR"})
    assert respuesta.status_code == 409
    assert "deudas" in respuesta.json()["detail"]


def test_prestar_resta_y_los_abonos_devuelven(client: TestClient, cuenta: dict) -> None:
    inicial = _saldo(client, cuenta)
    deuda = _deuda(client, sentido="me_deben", monto="300", cuenta_id=cuenta["id"])
    assert deuda["moneda"] == cuenta["moneda"]
    assert deuda["pendiente"] == "300.00"
    assert float(_saldo(client, cuenta)) == float(inicial) - 300

    deuda = client.post(f"/deudas/{deuda['id']}/abonos", json={"monto": "100", "fecha": "2026-10-05", "cuenta_id": cuenta["id"]}).json()
    assert (deuda["abonado"], deuda["pendiente"], deuda["fecha_saldada"]) == ("100.00", "200.00", None)
    assert float(_saldo(client, cuenta)) == float(inicial) - 200

    deuda = client.post(f"/deudas/{deuda['id']}/abonos", json={"monto": "200", "fecha": "2026-10-09", "cuenta_id": cuenta["id"]}).json()
    assert deuda["fecha_saldada"] == "2026-10-09"
    assert _saldo(client, cuenta) == inicial
    # Los préstamos no son gasto ni ingreso.
    resumen = client.get("/dashboard/resumen", params={"mes_anio": "2026-10"}).json()
    assert (resumen["ingresos"], resumen["gastos"]) == ("0.00", "0.00")


def test_que_te_presten_suma_y_pagar_resta(client: TestClient, cuenta: dict) -> None:
    inicial = float(_saldo(client, cuenta))
    deuda = _deuda(client, sentido="debo", monto="500", cuenta_id=cuenta["id"])
    assert float(_saldo(client, cuenta)) == inicial + 500
    client.post(f"/deudas/{deuda['id']}/abonos", json={"monto": "150", "fecha": "2026-10-03", "cuenta_id": cuenta["id"]})
    assert float(_saldo(client, cuenta)) == inicial + 350


def test_sin_cuenta_no_mueve_saldos(client: TestClient, cuenta: dict) -> None:
    inicial = _saldo(client, cuenta)
    deuda = _deuda(client, sentido="debo", monto="80")
    client.post(f"/deudas/{deuda['id']}/abonos", json={"monto": "30", "fecha": "2026-10-03"})
    assert _saldo(client, cuenta) == inicial
    assert client.get(f"/deudas/{deuda['id']}").json()["pendiente"] == "50.00"


def test_no_se_abona_mas_de_lo_pendiente(client: TestClient) -> None:
    deuda = _deuda(client, sentido="me_deben", monto="50")
    assert client.post(f"/deudas/{deuda['id']}/abonos", json={"monto": "60", "fecha": "2026-10-03"}).status_code == 400
    client.post(f"/deudas/{deuda['id']}/abonos", json={"monto": "50", "fecha": "2026-10-03"})
    assert client.post(f"/deudas/{deuda['id']}/abonos", json={"monto": "1", "fecha": "2026-10-04"}).status_code == 409


def test_la_cuenta_debe_estar_en_la_moneda_de_la_deuda(client: TestClient, cuenta: dict) -> None:
    respuesta = client.post(
        "/deudas",
        json={"persona": "Ana", "sentido": "debo", "monto": "10", "fecha": "2026-10-01", "moneda": "EUR", "cuenta_id": cuenta["id"]},
    )
    assert respuesta.status_code == 400


def test_borrar_un_abono_reabre_la_deuda(client: TestClient) -> None:
    deuda = _deuda(client, sentido="me_deben", monto="40")
    deuda = client.post(f"/deudas/{deuda['id']}/abonos", json={"monto": "40", "fecha": "2026-10-02"}).json()
    assert deuda["fecha_saldada"] == "2026-10-02"

    deuda = client.delete(f"/deudas/{deuda['id']}/abonos/{deuda['abonos'][0]['id']}").json()
    assert deuda["fecha_saldada"] is None
    assert deuda["pendiente"] == "40.00"


def test_editar_importe_por_debajo_de_lo_abonado(client: TestClient) -> None:
    deuda = _deuda(client, sentido="me_deben", monto="100")
    client.post(f"/deudas/{deuda['id']}/abonos", json={"monto": "70", "fecha": "2026-10-02"})
    assert client.patch(f"/deudas/{deuda['id']}", json={"monto": "50"}).status_code == 400
    # Bajarlo justo a lo abonado la salda.
    assert client.patch(f"/deudas/{deuda['id']}", json={"monto": "70"}).json()["fecha_saldada"] == "2026-10-02"


def test_listar_y_filtrar(client: TestClient) -> None:
    _deuda(client, sentido="me_deben", monto="10", fecha_vencimiento="2026-09-01")
    saldada = _deuda(client, persona="Luis", sentido="debo", monto="5")
    client.post(f"/deudas/{saldada['id']}/abonos", json={"monto": "5", "fecha": "2026-10-02"})

    assert [d["persona"] for d in client.get("/deudas", params={"pendientes": True}).json()] == ["Ana"]
    assert [d["persona"] for d in client.get("/deudas", params={"sentido": "debo"}).json()] == ["Luis"]
    assert client.get("/deudas").json()[0]["vencida"] is True


def test_no_se_borra_una_cuenta_con_deudas(client: TestClient, cuenta: dict) -> None:
    deuda = _deuda(client, sentido="me_deben", monto="10", cuenta_id=cuenta["id"])
    assert client.delete(f"/cuentas/{cuenta['id']}").status_code == 409
    client.delete(f"/deudas/{deuda['id']}")
    assert client.delete(f"/cuentas/{cuenta['id']}").status_code == 204
