"""Personalización: perfil, acento, página de inicio, widgets y mes financiero."""

from datetime import date

from fastapi.testclient import TestClient

from app.services import mes_financiero


def test_valores_por_defecto(client: TestClient) -> None:
    configuracion = client.get("/configuracion").json()
    assert configuracion["color_acento"] == "esmeralda"
    assert configuracion["pagina_inicio"] == "dashboard"
    assert configuracion["dia_inicio_mes"] == 1
    assert configuracion["nombre"] is None
    assert configuracion["widgets"] is None


def test_guardar_perfil_y_apariencia(client: TestClient) -> None:
    cambios = {"nombre": "  Rodrigo ", "avatar": "🦊", "color_acento": "violeta", "pagina_inicio": "transacciones"}
    configuracion = client.patch("/configuracion", json=cambios).json()
    assert configuracion["nombre"] == "Rodrigo"
    assert configuracion["avatar"] == "🦊"
    assert configuracion["color_acento"] == "violeta"
    # Lo no enviado no cambia; un texto vacío borra el nombre
    assert client.patch("/configuracion", json={"nombre": ""}).json()["nombre"] is None
    assert client.get("/configuracion").json()["avatar"] == "🦊"


def test_valores_no_validos(client: TestClient) -> None:
    assert client.patch("/configuracion", json={"color_acento": "dorado"}).status_code == 422
    assert client.patch("/configuracion", json={"dia_inicio_mes": 31}).status_code == 422
    assert client.patch("/configuracion", json={"pagina_inicio": "admin"}).status_code == 422


def test_disposicion_de_widgets(client: TestClient) -> None:
    widgets = [
        {"id": "grafico_flujo", "tamano": "grande", "visible": True},
        {"id": "balance", "tamano": "pequeno", "visible": False},
    ]
    assert client.patch("/configuracion", json={"widgets": widgets}).json()["widgets"] == widgets
    # null vuelve a la disposición por defecto
    assert client.patch("/configuracion", json={"widgets": None}).json()["widgets"] is None


def test_mes_financiero() -> None:
    assert mes_financiero.rango_mes("2026-10", 15) == (date(2026, 10, 15), date(2026, 11, 15))
    assert mes_financiero.rango_mes("2026-12", 15) == (date(2026, 12, 15), date(2027, 1, 15))
    assert mes_financiero.mes_de_fecha(date(2026, 10, 14), 15) == "2026-09"
    assert mes_financiero.mes_de_fecha(date(2026, 10, 15), 15) == "2026-10"
    assert mes_financiero.mes_de_fecha(date(2026, 1, 3), 15) == "2025-12"
    assert mes_financiero.mes_de_fecha(date(2026, 1, 3), 1) == "2026-01"


def test_dashboard_con_mes_que_empieza_el_15(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    client.patch("/configuracion", json={"dia_inicio_mes": 15})
    for fecha, monto in [("2026-10-10", "100"), ("2026-10-20", "30"), ("2026-11-14", "5")]:
        client.post("/transacciones", json={"monto": monto, "tipo": "gasto", "fecha": fecha,
                                             "cuenta_id": cuenta["id"], "categoria_id": categoria_gasto["id"]})

    # "Octubre" = del 15 oct al 14 nov: 30 + 5
    octubre = client.get("/dashboard/resumen", params={"mes_anio": "2026-10"}).json()
    assert octubre["gastos"] == "35.00"

    flujo = client.get("/dashboard/flujo-mensual", params={"hasta_mes": "2026-10", "meses": 2}).json()
    assert [(m["mes_anio"], m["gastos"]) for m in flujo] == [("2026-09", "100.00"), ("2026-10", "35.00")]


# Un PNG válido de 1×1 píxel, en base64.
PNG_1X1 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def test_foto_de_perfil(client: TestClient) -> None:
    assert client.get("/configuracion/foto").status_code == 404
    configuracion = client.put("/configuracion/foto", json={"imagen": f"data:image/png;base64,{PNG_1X1}"}).json()
    assert configuracion["foto_version"]

    foto = client.get("/configuracion/foto")
    assert foto.status_code == 200
    assert foto.headers["content-type"] == "image/png"
    assert foto.content.startswith(b"\x89PNG")

    assert client.delete("/configuracion/foto").json()["foto_version"] is None
    assert client.get("/configuracion/foto").status_code == 404


def test_foto_no_valida(client: TestClient) -> None:
    def subir(imagen: str) -> int:
        return client.put("/configuracion/foto", json={"imagen": imagen}).status_code

    assert subir("hola") == 400  # no es un data URL
    assert subir(f"data:image/gif;base64,{PNG_1X1}") == 400  # tipo no admitido
    assert subir(f"data:image/jpeg;base64,{PNG_1X1}") == 400  # dice JPEG pero es PNG
    assert subir("data:image/png;base64,@@@") == 400  # base64 roto
