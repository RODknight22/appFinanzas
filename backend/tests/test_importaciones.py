"""Importar extractos: vista previa (categoría aprendida, duplicados) y confirmación."""

import pytest
from fastapi.testclient import TestClient

from app.services.importaciones import clave_concepto

EXTRACTO = (
    "Fecha;Concepto;Importe;Saldo\n"
    "02/10/2026;COMPRA TARJ. 4567 MERCADONA VALENCIA;-45,20;954,80\n"
    "03/10/2026;MERCADONA MADRID;-12,00;942,80\n"
    "04/10/2026;Ferreteria Pepe;-8,50;934,30\n"
    "05/10/2026;NOMINA ACME SL;2.000,00;2.934,30\n"
).encode()


def _vista_previa(client: TestClient, cuenta_id: int, contenido: bytes = EXTRACTO, **params) -> dict:
    respuesta = client.post(
        "/importaciones/vista-previa", params={"cuenta_id": cuenta_id, **params}, content=contenido
    )
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _anotar(client: TestClient, cuenta: dict, categoria: dict, monto: str, fecha: str, notas: str) -> None:
    respuesta = client.post("/transacciones", json={
        "monto": monto, "tipo": categoria["tipo"], "fecha": fecha, "notas": notas,
        "categoria_id": categoria["id"], "cuenta_id": cuenta["id"],
    })
    assert respuesta.status_code == 201, respuesta.text


def _categorias(client: TestClient) -> dict[str, int]:
    return {c["nombre"]: c["id"] for c in client.get("/categorias").json()}


@pytest.mark.parametrize(
    ("concepto", "clave"),
    [
        ("COMPRA TARJ. 4567 MERCADONA VALENCIA 02/10", "mercadona valencia"),
        ("Pago en Café Ñandú", "cafe nandu"),
        ("12345", ""),
        (None, ""),
    ],
)
def test_clave_del_concepto_ignora_numeros_tildes_y_relleno(concepto: str | None, clave: str) -> None:
    assert clave_concepto(concepto) == clave


def test_la_vista_previa_aprende_la_categoria_del_historial(
    client: TestClient, cuenta: dict, categoria_gasto: dict, categoria_ingreso: dict
) -> None:
    # Ya se categorizó antes un Mercadona de Valencia (con otra tarjeta y otra fecha) y una nómina.
    _anotar(client, cuenta, categoria_gasto, "30", "2026-09-01", "COMPRA TARJ. 1111 MERCADONA VALENCIA")
    _anotar(client, cuenta, categoria_ingreso, "2000", "2026-09-05", "NOMINA ACME SL")

    vista = _vista_previa(client, cuenta["id"])
    otros = _categorias(client)

    resumen = [(f["fila"], f["tipo"], f["monto"], f["categoria_id"], f["confianza"]) for f in vista["filas"]]
    assert resumen == [
        (2, "gasto", "45.20", categoria_gasto["id"], "alta"),  # mismo comercio y ciudad
        (3, "gasto", "12.00", categoria_gasto["id"], "media"),  # mismo comercio, otra ciudad
        (4, "gasto", "8.50", otros["Otros gastos"], "ninguna"),  # nunca visto
        (5, "ingreso", "2000.00", categoria_ingreso["id"], "alta"),
    ]
    assert vista["columnas"] == {"fecha": "Fecha", "concepto": "Concepto", "importe": "Importe"}
    # Solo es una vista previa: no se ha guardado ninguna transacción nueva.
    assert len(client.get("/transacciones").json()) == 2


def test_marca_como_duplicado_lo_ya_registrado(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    # Anotado a mano un día antes que el cargo del banco: es el mismo gasto.
    _anotar(client, cuenta, categoria_gasto, "45.20", "2026-10-01", "Súper")
    # El "ingreso" de 2.000 ya está como transferencia desde otra cuenta.
    ahorro = client.post("/cuentas", json={"nombre": "Ahorro", "tipo": "ahorro", "balance_inicial": "5000"}).json()
    client.post("/transferencias", json={
        "cuenta_origen_id": ahorro["id"], "cuenta_destino_id": cuenta["id"], "monto_origen": "2000", "fecha": "2026-10-05",
    })

    vista = _vista_previa(client, cuenta["id"])
    assert [f["duplicado"] for f in vista["filas"]] == [True, False, False, True]


def test_dos_gastos_iguales_el_mismo_dia_no_se_confunden_con_uno_ya_registrado(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    _anotar(client, cuenta, categoria_gasto, "1.50", "2026-10-02", "Café")
    extracto = b"Fecha;Concepto;Importe\n02/10/2026;Cafe;-1,50\n02/10/2026;Cafe;-1,50\n"
    assert [f["duplicado"] for f in _vista_previa(client, cuenta["id"], extracto)["filas"]] == [True, False]


def test_invertir_signos_para_tarjetas_que_exportan_las_compras_en_positivo(client: TestClient, cuenta: dict) -> None:
    extracto = b"Fecha;Concepto;Importe\n02/10/2026;Amazon;23,99\n03/10/2026;Devolucion Amazon;-23,99\n"
    vista = _vista_previa(client, cuenta["id"], extracto, invertir_signos="true")
    assert [f["tipo"] for f in vista["filas"]] == ["gasto", "ingreso"]


def test_confirmar_crea_las_transacciones_y_mueven_el_saldo(client: TestClient, cuenta: dict) -> None:
    vista = _vista_previa(client, cuenta["id"])
    movimientos = [
        {k: f[k] for k in ("fecha", "monto", "tipo", "concepto", "categoria_id")}
        for f in vista["filas"] if not f["duplicado"]
    ]
    respuesta = client.post("/importaciones", json={"cuenta_id": cuenta["id"], "movimientos": movimientos})
    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json() == {"creadas": 4}

    notas = {t["notas"] for t in client.get("/transacciones").json()}
    assert "NOMINA ACME SL" in notas
    saldo = client.get("/dashboard/resumen").json()["cuentas"][0]["saldo"]
    assert saldo == "2934.30"  # 1000 - 45.20 - 12 - 8.50 + 2000: el mismo saldo que dice el banco

    # Reimportar el mismo archivo: ahora todo sale como duplicado.
    assert all(f["duplicado"] for f in _vista_previa(client, cuenta["id"])["filas"])


def test_cuenta_en_euros_convierte_a_la_moneda_principal(client: TestClient, tasas: None) -> None:
    revolut = client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()
    vista = _vista_previa(client, revolut["id"], b"Fecha;Concepto;Importe\n02/10/2026;Metro;-9,00\n")
    fila = vista["filas"][0]
    client.post("/importaciones", json={"cuenta_id": revolut["id"], "movimientos": [
        {k: fila[k] for k in ("fecha", "monto", "tipo", "concepto", "categoria_id")}
    ]})
    transaccion = client.get("/transacciones").json()[0]
    # 9 EUR con 0.9 EUR y 18 MXN por dólar = 180 MXN (la principal por defecto).
    assert (transaccion["moneda"], transaccion["monto_cuenta"], transaccion["monto_principal"]) == ("EUR", "9.00", "180.00")


def test_si_un_movimiento_no_es_valido_no_se_importa_ninguno(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    movimientos = [
        {"fecha": "2026-10-02", "monto": "10", "tipo": "gasto", "concepto": "Bien", "categoria_id": categoria_gasto["id"]},
        # Un ingreso con categoría de gasto: incoherente.
        {"fecha": "2026-10-03", "monto": "20", "tipo": "ingreso", "concepto": "Mal", "categoria_id": categoria_gasto["id"]},
    ]
    respuesta = client.post("/importaciones", json={"cuenta_id": cuenta["id"], "movimientos": movimientos})
    assert respuesta.status_code == 400
    assert client.get("/transacciones").json() == []


@pytest.mark.parametrize(
    ("cuenta_id", "contenido", "mensaje"),
    [
        (999, EXTRACTO, "No existe la cuenta"),
        (None, b"", "vac"),
        (None, b"hola\nadios\n", "columnas de fecha e importe"),
    ],
)
def test_errores_legibles(client: TestClient, cuenta: dict, cuenta_id: int | None, contenido: bytes, mensaje: str) -> None:
    respuesta = client.post(
        "/importaciones/vista-previa", params={"cuenta_id": cuenta_id or cuenta["id"]}, content=contenido
    )
    assert respuesta.status_code == 400
    assert mensaje in respuesta.json()["detail"]


def test_importar_exige_sesion(cliente_sin_sesion: TestClient) -> None:
    respuesta = cliente_sin_sesion.post("/importaciones/vista-previa", params={"cuenta_id": 1}, content=EXTRACTO)
    assert respuesta.status_code == 401


@pytest.mark.parametrize("por_trozos", [False, True], ids=["con-tamano", "chunked"])
def test_archivo_de_mas_de_1_mb_se_rechaza_tambien_en_desarrollo(client: TestClient, cuenta: dict, por_trozos: bool) -> None:
    grande = b"Fecha;Concepto;Importe\n" + b"01/10/2026;Cafe;-1,50\n" * 60_000  # ~1,3 MB

    def trozos():
        for inicio in range(0, len(grande), 64_000):
            yield grande[inicio:inicio + 64_000]

    respuesta = client.post(
        "/importaciones/vista-previa", params={"cuenta_id": cuenta["id"]}, content=trozos() if por_trozos else grande
    )
    assert respuesta.status_code == 413
    assert "1 MB" in respuesta.json()["detail"]
