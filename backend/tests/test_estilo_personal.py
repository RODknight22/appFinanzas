"""Estilo personalizado: tono e intensidad propios, guardados en Configuración."""

from fastapi.testclient import TestClient


def test_por_defecto_el_tono_y_la_intensidad_de_fintech(client: TestClient) -> None:
    configuracion = client.get("/configuracion").json()
    assert (configuracion["tinte_personal"], configuracion["viveza_personal"]) == (275, 100)


def test_se_guardan_el_tono_y_la_intensidad(client: TestClient) -> None:
    cambios = {"estilo_visual": "personal", "tinte_personal": 20, "viveza_personal": 250}
    guardada = client.patch("/configuracion", json=cambios).json()
    assert (guardada["estilo_visual"], guardada["tinte_personal"], guardada["viveza_personal"]) == ("personal", 20, 250)
    # 0 es un valor válido (rojo puro / gris), no "sin elegir".
    guardada = client.patch("/configuracion", json={"tinte_personal": 0, "viveza_personal": 0}).json()
    assert (guardada["tinte_personal"], guardada["viveza_personal"]) == (0, 0)
    assert client.get("/configuracion").json()["tinte_personal"] == 0


def test_valores_fuera_de_rango(client: TestClient) -> None:
    assert client.patch("/configuracion", json={"tinte_personal": 361}).status_code == 422
    assert client.patch("/configuracion", json={"viveza_personal": -1}).status_code == 422
    assert client.patch("/configuracion", json={"viveza_personal": 401}).status_code == 422
