"""Avisos de la campana: se calculan al vuelo y se recuerdan los leídos."""

from datetime import date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.services import notificaciones


def _claves(session: Session, ahora: datetime | None = None) -> set[str]:
    return {a.clave for a in notificaciones.listar(session, ahora)}


def test_sin_datos_no_hay_avisos(client: TestClient) -> None:
    assert client.get("/notificaciones").json() == []


def test_pago_proximo_y_marcar_leido(client: TestClient) -> None:
    manana = date.today() + timedelta(days=1)
    s = client.post(
        "/suscripciones",
        json={"nombre": "Netflix", "monto": "15.99", "periodicidad": "mensual", "fecha_proximo_pago": str(manana)},
    ).json()
    # Una que vence lejos no avisa.
    client.post(
        "/suscripciones",
        json={"nombre": "Lejos", "monto": "1", "periodicidad": "anual", "fecha_proximo_pago": str(manana + timedelta(days=30))},
    )

    avisos = client.get("/notificaciones").json()
    assert [a["titulo"] for a in avisos] == ["Pago de Netflix"]
    aviso = avisos[0]
    assert aviso["clave"] == f"suscripcion:{s['id']}:{manana}"
    assert (aviso["mensaje"], aviso["monto"], aviso["leida"]) == ("Vence mañana", "15.99", False)

    assert client.post("/notificaciones/leidas", json={"claves": [aviso["clave"]]}).status_code == 204
    assert client.get("/notificaciones").json()[0]["leida"] is True


def test_deuda_vencida_es_urgente(client: TestClient) -> None:
    ayer = date.today() - timedelta(days=1)
    client.post(
        "/deudas",
        json={"persona": "Ana", "sentido": "me_deben", "monto": "50", "fecha": "2026-01-01", "fecha_vencimiento": str(ayer)},
    )
    aviso = client.get("/notificaciones").json()[0]
    assert (aviso["tipo"], aviso["titulo"], aviso["urgente"]) == ("deuda", "Ana te debe", True)
    assert aviso["mensaje"] == "Vence atrasado 1 día"


def test_presupuesto_al_80_y_excedido(client: TestClient, cuenta: dict, categoria_gasto: dict) -> None:
    mes = date.today().strftime("%Y-%m")  # mes natural: el día de inicio por defecto es el 1
    client.post("/presupuestos", json={"categoria_id": categoria_gasto["id"], "monto_limite": "100", "mes_anio": mes})
    gasto = {"tipo": "gasto", "fecha": str(date.today()), "cuenta_id": cuenta["id"], "categoria_id": categoria_gasto["id"]}
    client.post("/transacciones", json={**gasto, "monto": "85"})
    aviso = client.get("/notificaciones").json()[0]
    assert aviso["clave"].endswith(":80") and aviso["urgente"] is False

    client.post("/transacciones", json={**gasto, "monto": "20"})
    aviso = client.get("/notificaciones").json()[0]
    assert aviso["clave"].endswith(":100") and aviso["urgente"] is True


def test_hito_de_meta(client: TestClient) -> None:
    meta = client.post("/metas", json={"nombre": "Viaje", "monto_objetivo": "1000"}).json()
    client.post(f"/metas/{meta['id']}/aportaciones", json={"monto": "550", "fecha": str(date.today())})
    aviso = client.get("/notificaciones").json()[0]
    assert (aviso["clave"], aviso["mensaje"]) == (f"meta:{meta['id']}:50", "¡Ya llevas el 50 %!")


def test_recordatorio_diario(client: TestClient, session: Session, cuenta: dict, categoria_gasto: dict) -> None:
    noche = datetime.combine(date.today(), datetime.min.time()).replace(hour=22)
    assert not notificaciones.recordatorio_pendiente(session, noche)  # desactivado por defecto

    client.patch("/configuracion", json={"recordatorio_diario": True, "hora_recordatorio": 21})
    assert not notificaciones.recordatorio_pendiente(session, noche.replace(hour=20))  # aún no es la hora
    assert f"recordatorio:{date.today()}" in _claves(session, noche)

    client.post(
        "/transacciones",
        json={"monto": "5", "tipo": "gasto", "fecha": str(date.today()), "cuenta_id": cuenta["id"], "categoria_id": categoria_gasto["id"]},
    )
    assert not notificaciones.recordatorio_pendiente(session, noche)  # ya anotaste algo hoy


def test_correo_de_recordatorios(client: TestClient) -> None:
    assert client.patch("/configuracion", json={"correo_recordatorios": "rodrigo@ejemplo.com"}).json()["correo_recordatorios"] == "rodrigo@ejemplo.com"
    assert client.patch("/configuracion", json={"correo_recordatorios": "no-es-correo"}).status_code == 422
    assert client.patch("/configuracion", json={"correo_recordatorios": ""}).json()["correo_recordatorios"] is None
