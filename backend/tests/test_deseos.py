"""Lista de deseos, máquina del tiempo y vínculo con metas."""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Deseo
from app.schemas import DecisionDeseo, DeseoCreate
from app.services import deseos as servicio
from app.services.errores import ConflictoError


def _deseo(client: TestClient, **datos) -> dict:
    respuesta = client.post("/deseos", json={"nombre": "Zapatillas", "precio": "89.99", **datos})
    assert respuesta.status_code == 201, respuesta.json()
    return respuesta.json()


def test_crear_un_deseo_con_enlace(client: TestClient) -> None:
    deseo = _deseo(client, enlace="https://www.amazon.es/dp/B0123", prioridad="alta")
    assert deseo["estado"] == "deseado"
    assert deseo["tienda"] == "amazon.es"
    assert deseo["moneda"] == "MXN"  # la principal


@pytest.mark.parametrize("enlace", ["javascript:alert(1)", "ftp://x.com", "amazon.es/dp/1"])
def test_solo_enlaces_http(client: TestClient, enlace: str) -> None:
    respuesta = client.post("/deseos", json={"nombre": "X", "precio": "1", "enlace": enlace})
    assert respuesta.status_code == 422


def test_la_maquina_del_tiempo_no_deja_comprar_antes_de_tiempo(client: TestClient) -> None:
    deseo = _deseo(client, dias_reflexion=7, carta="Lo quiero para correr la media maratón")
    assert deseo["estado"] == "en_reflexion"
    assert deseo["listo_para_decidir"] is False

    respuesta = client.post(f"/deseos/{deseo['id']}/decidir", json={"decision": "comprar"})
    assert respuesta.status_code == 409
    assert "espera" in respuesta.json()["detail"]
    # Descartar sí se puede siempre.
    descartado = client.post(f"/deseos/{deseo['id']}/decidir", json={"decision": "descartar"}).json()
    assert descartado["estado"] == "descartado"
    assert descartado["fecha_decision"] is not None


def test_al_acabar_la_reflexion_se_puede_decidir(session: Session) -> None:
    hace_8_dias = datetime.now() - timedelta(days=8)
    deseo = servicio.crear(session, DeseoCreate(nombre="Consola", precio=300, dias_reflexion=7), ahora=hace_8_dias)

    assert servicio.obtener(session, deseo.id).listo_para_decidir is True
    comprado = servicio.decidir(session, deseo.id, DecisionDeseo(decision="comprar"))
    assert comprado.estado == "comprado"
    with pytest.raises(ConflictoError):
        servicio.decidir(session, deseo.id, DecisionDeseo(decision="descartar"))


def test_guardar_lo_deja_en_la_lista_y_se_puede_volver_a_reflexionar(session: Session, client: TestClient) -> None:
    deseo = _deseo(client, dias_reflexion=1)
    fila = session.get(Deseo, deseo["id"])
    fila.reflexion_hasta = datetime.now() - timedelta(minutes=1)
    session.add(fila)
    session.commit()

    guardado = client.post(f"/deseos/{deseo['id']}/decidir", json={"decision": "guardar"}).json()
    assert (guardado["estado"], guardado["reflexion_hasta"]) == ("deseado", None)

    otra_vez = client.post(f"/deseos/{deseo['id']}/reflexionar", json={"dias": 30}).json()
    assert otra_vez["estado"] == "en_reflexion"


def test_convertir_en_meta_y_borrar_la_meta(client: TestClient) -> None:
    deseo = _deseo(client, moneda="EUR")
    vinculado = client.post(f"/deseos/{deseo['id']}/crear-meta").json()
    meta = next(m for m in client.get("/metas").json() if m["id"] == vinculado["meta_id"])
    assert (meta["nombre"], meta["monto_objetivo"], meta["moneda"]) == ("Zapatillas", "89.99", "EUR")
    assert client.post(f"/deseos/{deseo['id']}/crear-meta").status_code == 409

    client.delete(f"/metas/{meta['id']}")
    assert client.get(f"/deseos/{deseo['id']}").json()["meta_id"] is None


def test_lista_por_prioridad_y_filtro_por_estado(client: TestClient) -> None:
    _deseo(client, nombre="Baja", prioridad="baja")
    _deseo(client, nombre="Alta", prioridad="alta")
    _deseo(client, nombre="Pensándolo", dias_reflexion=3)

    assert [d["nombre"] for d in client.get("/deseos", params={"estado": "deseado"}).json()] == ["Alta", "Baja"]
    assert [d["nombre"] for d in client.get("/deseos", params={"estado": "en_reflexion"}).json()] == ["Pensándolo"]
