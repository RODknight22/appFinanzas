"""Metas de ahorro: progreso por cuenta vinculada o por aportaciones."""

from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.schemas import MetaCreate
from app.services import metas as servicio


def _meta(client: TestClient, **datos) -> dict:
    respuesta = client.post("/metas", json={"nombre": "Viaje", "monto_objetivo": "1000", **datos})
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def _aportar(client: TestClient, meta: dict, monto: str):
    return client.post(f"/metas/{meta['id']}/aportaciones", json={"monto": monto, "fecha": "2026-10-01"})


def test_con_aportaciones(client: TestClient) -> None:
    meta = _meta(client)
    assert (meta["ahorrado"], meta["porcentaje"], meta["moneda"]) == ("0.00", 0.0, "MXN")

    _aportar(client, meta, "300")
    _aportar(client, meta, "-50")  # una retirada

    meta = client.get(f"/metas/{meta['id']}").json()
    assert (meta["ahorrado"], meta["restante"], meta["porcentaje"]) == ("250.00", "750.00", 25.0)
    assert len(client.get(f"/metas/{meta['id']}/aportaciones").json()) == 2


def test_no_se_retira_mas_de_lo_ahorrado_ni_se_aporta_cero(client: TestClient) -> None:
    meta = _meta(client)
    _aportar(client, meta, "100")
    assert _aportar(client, meta, "-101").status_code == 400
    assert _aportar(client, meta, "0").status_code == 422


def test_vinculada_a_una_cuenta_sigue_su_saldo(client: TestClient, cuenta: dict) -> None:
    # La cuenta "Banco" tiene 1000 de balance inicial.
    meta = _meta(client, monto_objetivo="4000", cuenta_id=cuenta["id"])
    assert (meta["ahorrado"], meta["porcentaje"]) == ("1000.00", 25.0)

    # No admite aportaciones a mano: su progreso es el saldo.
    assert _aportar(client, meta, "10").status_code == 409
    # Y la cuenta no se puede borrar mientras esté vinculada.
    assert client.delete(f"/cuentas/{cuenta['id']}").status_code == 409


def test_cuenta_en_otra_moneda_se_convierte(client: TestClient, tasas: None) -> None:
    revolut = client.post(
        "/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR", "balance_inicial": "90"}
    ).json()
    # Por defecto, la meta usa la moneda de su cuenta...
    assert _meta(client, cuenta_id=revolut["id"])["moneda"] == "EUR"
    # ...pero puede medirse en otra: 90 EUR = 100 USD con las tasas de ejemplo.
    assert _meta(client, nombre="Otra", moneda="USD", cuenta_id=revolut["id"])["ahorrado"] == "100.00"


def test_al_alcanzar_el_objetivo_queda_cumplida(client: TestClient) -> None:
    meta = _meta(client, monto_objetivo="100")
    _aportar(client, meta, "100")
    cumplida = client.get(f"/metas/{meta['id']}").json()
    assert cumplida["cumplida"] and cumplida["fecha_cumplida"] == date.today().isoformat()

    # Sigue cumplida aunque después se retire dinero...
    _aportar(client, meta, "-40")
    assert client.get(f"/metas/{meta['id']}").json()["cumplida"]

    # ...hasta que se sube el objetivo.
    assert not client.patch(f"/metas/{meta['id']}", json={"monto_objetivo": "200"}).json()["cumplida"]


def test_marcar_a_mano_y_reabrir(client: TestClient) -> None:
    meta = _meta(client)
    assert client.patch(f"/metas/{meta['id']}", json={"cumplida": True}).json()["cumplida"]
    assert not client.patch(f"/metas/{meta['id']}", json={"cumplida": False}).json()["cumplida"]


def test_ahorro_mensual_necesario(session: Session) -> None:
    hoy = date(2026, 1, 1)
    meta = servicio.crear(
        session, MetaCreate(nombre="Coche", monto_objetivo=Decimal("1200"), fecha_limite=date(2026, 12, 31)), hoy=hoy
    )
    # 364 días ≈ 12 meses → 100 al mes.
    assert (meta.meses_restantes, meta.ahorro_mensual) == (12, Decimal("100.00"))

    vencida = servicio.crear(
        session, MetaCreate(nombre="Tarde", monto_objetivo=Decimal("10"), fecha_limite=hoy - timedelta(days=1)), hoy=hoy
    )
    assert vencida.vencida and vencida.ahorro_mensual is None


def test_orden_activas_primero(client: TestClient) -> None:
    _meta(client, nombre="Lejana", fecha_limite="2030-01-01")
    _meta(client, nombre="Cercana", fecha_limite="2027-01-01")
    hecha = _meta(client, nombre="Hecha")
    client.patch(f"/metas/{hecha['id']}", json={"cumplida": True})
    assert [m["nombre"] for m in client.get("/metas").json()] == ["Cercana", "Lejana", "Hecha"]


def test_no_se_vincula_una_meta_con_aportaciones(client: TestClient, cuenta: dict) -> None:
    meta = _meta(client)
    _aportar(client, meta, "10")
    assert client.patch(f"/metas/{meta['id']}", json={"cuenta_id": cuenta["id"]}).status_code == 409
    assert client.patch(f"/metas/{meta['id']}", json={"moneda": "EUR"}).status_code == 409


def test_borrar_meta_borra_sus_aportaciones(client: TestClient) -> None:
    meta = _meta(client)
    _aportar(client, meta, "10")
    assert client.delete(f"/metas/{meta['id']}").status_code == 204
    assert client.get(f"/metas/{meta['id']}/aportaciones").status_code == 404
