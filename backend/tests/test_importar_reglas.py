"""Importación más lista: reglas de categoría y unir lo que ya estaba en otra cuenta."""

from fastapi.testclient import TestClient

from tests.test_importaciones import REVOLUT_MXN, _movimientos, _vista_previa


def _categorias(client: TestClient) -> dict[str, int]:
    """Las que usan estos tests (la BD de los tests empieza sin las de serie)."""
    nombres = [("Supermercado", "gasto"), ("Restaurantes", "gasto"), ("Transporte", "gasto"), ("Ocio", "gasto"),
               ("Sueldo", "ingreso"), ("Traspasos", "ingreso")]
    return {n: client.post("/categorias", json={"nombre": n, "tipo": t}).json()["id"] for n, t in nombres}


# --- Reglas -------------------------------------------------------------------
def test_las_reglas_mandan_sobre_el_historial(client: TestClient, cuenta: dict) -> None:
    ids = _categorias(client)
    # El historial dice Restaurantes para "MERCADONA"; la regla dice Supermercado.
    client.post("/transacciones", json={
        "monto": "10", "tipo": "gasto", "fecha": "2026-09-01", "notas": "MERCADONA",
        "categoria_id": ids["Restaurantes"], "cuenta_id": cuenta["id"],
    })
    for texto, categoria in [("mercadona", "Supermercado"), ("Mercadona Online", "Transporte"), ("nómina", "Sueldo")]:
        assert client.post("/reglas-categoria", json={"texto": texto, "categoria_id": ids[categoria]}).status_code == 201

    extracto = (
        "Fecha;Concepto;Importe\n"
        "02/10/2026;COMPRA MERCADONA VALENCIA;-45,20\n"
        "03/10/2026;MERCADONA ONLINE PEDIDO;-60,00\n"
        "04/10/2026;NOMINA ACME;2000,00\n"
    ).encode()
    filas = _vista_previa(client, cuenta["id"], extracto)["filas"]
    # Sin tildes ni mayúsculas, y la regla más concreta (la más larga) gana.
    assert [(f["categoria_id"], f["confianza"]) for f in filas] == [
        (ids["Supermercado"], "alta"), (ids["Transporte"], "alta"), (ids["Sueldo"], "alta"),
    ]


def test_reglas_repetidas_se_editan_y_se_borran_con_su_categoria(client: TestClient) -> None:
    ids = _categorias(client)
    regla = client.post("/reglas-categoria", json={"texto": "  Netflix ", "categoria_id": ids["Ocio"]}).json()
    assert regla["texto"] == "Netflix"
    # Otra regla con el mismo texto para gastos sería ambigua; para ingresos no choca.
    assert client.post("/reglas-categoria", json={"texto": "NETFLIX", "categoria_id": ids["Supermercado"]}).status_code == 409
    assert client.post("/reglas-categoria", json={"texto": "netflix", "categoria_id": ids["Sueldo"]}).status_code == 201

    nueva = client.post("/categorias", json={"nombre": "Streaming", "tipo": "gasto"}).json()
    editada = client.patch(f"/reglas-categoria/{regla['id']}", json={"categoria_id": nueva["id"]}).json()
    assert editada["categoria_id"] == nueva["id"]
    assert client.delete(f"/categorias/{nueva['id']}").status_code == 204
    assert [r["texto"] for r in client.get("/reglas-categoria").json()] == ["netflix"]


# --- Completar una transferencia importada desde la otra cuenta --------------------
def test_el_otro_lado_de_un_cambio_completa_la_transferencia(client: TestClient, cuenta: dict, tasas: None) -> None:
    revolut_mxn = client.post("/cuentas", json={"nombre": "Revolut MXN", "tipo": "debito", "moneda": "MXN"}).json()
    revolut_eur = client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()
    vista = _vista_previa(client, revolut_mxn["id"], REVOLUT_MXN)
    client.post("/importaciones", json={"cuenta_id": revolut_mxn["id"], "movimientos": _movimientos(vista)})

    # El extracto en euros trae el mismo cambio: salieron 98.50 EUR (la app estimó 100).
    euros = (
        b"Type,Started Date,Completed Date,Description,Amount,Fee,Balance\n"
        b"TRANSFER,2026-10-02 09:59:00,2026-10-02 10:00:05,To MXN,-98.50,0.00,401.50\n"
    )
    [fila] = _vista_previa(client, revolut_eur["id"], euros)["filas"]
    assert not fila["duplicado"] and fila["confianza"] == "alta"
    assert fila["cuenta_transferencia_id"] == revolut_mxn["id"] and fila["transferencia_a_completar_id"] is not None

    hecho = client.post("/importaciones", json={"cuenta_id": revolut_eur["id"], "movimientos": [_movimientos({"filas": [fila]})[0]]})
    assert hecho.json() == {"creadas": 0, "transferencias": 0, "unidas": 0, "completadas": 1}
    [transferencia] = client.get("/transferencias").json()
    # Ahora los dos lados son reales: 98.50 EUR (1970 MXN al BCE) dieron 2000 MXN, 30 MXN a favor.
    assert (transferencia["monto_origen"], transferencia["monto_destino"], transferencia["coste"]) == ("98.50", "2000.00", "-30.00")
    # Y volver a importar el extracto en euros ya no propone nada nuevo.
    assert _vista_previa(client, revolut_eur["id"], euros)["filas"][0]["duplicado"]


# --- Unir con un ingreso o gasto suelto de otra cuenta ----------------------------
def test_el_mismo_importe_en_otra_cuenta_se_une_en_una_transferencia(client: TestClient, cuenta: dict) -> None:
    ids = _categorias(client)
    revolut = client.post("/cuentas", json={"nombre": "Revolut MXN", "tipo": "debito", "moneda": "MXN"}).json()
    # En el banco se anotó como ingreso lo que en realidad venía de Revolut.
    client.post("/transacciones", json={
        "monto": "500", "tipo": "ingreso", "fecha": "2026-10-03", "notas": "Traspaso recibido",
        "categoria_id": ids["Traspasos"], "cuenta_id": cuenta["id"],
    })

    extracto = b"Fecha;Concepto;Importe\n02/10/2026;Envio a mi banco;-500,00\n03/10/2026;Cafe;-500,00\n"
    envio, cafe = _vista_previa(client, revolut["id"], extracto)["filas"]
    # Un solo ingreso de 500: solo se une con la primera fila, y queda por revisar.
    assert (envio["cuenta_transferencia_id"], envio["confianza"]) == (cuenta["id"], "media")
    assert envio["transaccion_a_unir_id"] is not None and cafe["transaccion_a_unir_id"] is None

    hecho = client.post("/importaciones", json={"cuenta_id": revolut["id"], "movimientos": [_movimientos({"filas": [envio]})[0]]})
    assert hecho.json() == {"creadas": 1, "transferencias": 1, "unidas": 1, "completadas": 0}
    resumen = client.get("/dashboard/resumen", params={"mes_anio": "2026-10"}).json()
    assert resumen["ingresos"] == "0.00"  # el ingreso suelto ya es la mitad de la transferencia
    saldos = {c["nombre"]: c["saldo"] for c in resumen["cuentas"]}
    assert saldos == {"Banco": "1500.00", "Revolut MXN": "-500.00"}


def test_la_misma_transferencia_no_se_completa_en_dos_filas(client: TestClient) -> None:
    cuenta = client.post("/cuentas", json={"nombre": "A", "tipo": "debito"}).json()
    ingreso = client.post("/categorias", json={"nombre": "I", "tipo": "ingreso"}).json()
    fila = {"fecha": "2026-10-01", "monto": "10", "tipo": "ingreso", "concepto": "x",
            "categoria_id": ingreso["id"], "transferencia_a_completar_id": 1}
    respuesta = client.post("/importaciones", json={"cuenta_id": cuenta["id"], "movimientos": [fila, fila]})
    assert respuesta.status_code == 400
    assert "dos filas" in respuesta.json()["detail"]
