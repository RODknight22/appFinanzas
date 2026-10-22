"""Servidores de producción y de desarrollo: web + API en un solo origen y sus defensas HTTP."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.seguridad_http import ProteccionLocal
from app.services import acceso
from app.servidor import crear_aplicacion


@pytest.fixture
def web(tmp_path: Path, cliente_sin_sesion: TestClient) -> TestClient:
    """El servidor de producción con una web compilada de mentira.

    `cliente_sin_sesion` ya sustituye la BD por la de pruebas en la API, que es
    el mismo objeto que aquí se monta en /api. Sin `with`: no se ejecuta el
    arranque (init_db), que tocaría la BD real.
    """
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>app</html>")
    (tmp_path / "assets" / "app-abc123.js").write_text("console.log(1)")
    return TestClient(crear_aplicacion(tmp_path), base_url="http://127.0.0.1:8765")


def test_api_bajo_api_y_web_en_la_raiz(web: TestClient) -> None:
    assert web.get("/api/health").json()["app"] == "appfinanzas"
    assert web.get("/api/cuentas").status_code == 401  # los datos siguen protegidos
    assert web.get("/api/no-existe").status_code == 404  # no devuelve la web


def test_rutas_de_la_web_devuelven_index(web: TestClient) -> None:
    # Recargar en /metas debe abrir la app, no dar 404.
    for ruta in ("/", "/dashboard", "/metas"):
        respuesta = web.get(ruta)
        assert respuesta.status_code == 200 and "app" in respuesta.text
        assert respuesta.headers["cache-control"] == "no-cache"


def test_assets_con_cache_larga(web: TestClient) -> None:
    assert "immutable" in web.get("/assets/app-abc123.js").headers["cache-control"]


def test_cabeceras_de_seguridad(web: TestClient) -> None:
    cabeceras = web.get("/").headers
    assert "script-src 'self'" in cabeceras["content-security-policy"]
    assert cabeceras["x-frame-options"] == "DENY"
    assert cabeceras["x-content-type-options"] == "nosniff"


def test_host_ajeno_rechazado(web: TestClient) -> None:
    # DNS rebinding: evil.com resuelve a 127.0.0.1, pero el Host sigue siendo evil.com.
    assert web.get("/api/health", headers={"host": "evil.com"}).status_code == 400
    assert web.get("/api/health", headers={"host": "localhost:8765"}).status_code == 200


def test_escritura_desde_otra_web_rechazada(web: TestClient) -> None:
    datos = {"usuario": "x", "contrasena": "12345678"}
    ajena = web.post("/api/auth/login", json=datos, headers={"origin": "http://evil.com"})
    assert ajena.status_code == 403
    propia = web.post("/api/auth/login", json=datos, headers={"origin": "http://127.0.0.1:8765"})
    assert propia.status_code != 403


def test_peticion_demasiado_grande(web: TestClient) -> None:
    respuesta = web.post("/api/auth/login", content=b"x" * 1_000_001, headers={"content-type": "application/json"})
    assert respuesta.status_code == 413


def test_peticion_grande_enviada_por_trozos_sin_tamano_tambien_se_rechaza(web: TestClient) -> None:
    """Sin Content-Length (Transfer-Encoding: chunked) el middleware cuenta los bytes reales."""

    def trozos():
        for _ in range(20):
            yield b"x" * 64_000  # 1,28 MB en total

    respuesta = web.post("/api/auth/login", content=trozos(), headers={"content-type": "application/json"})
    assert respuesta.status_code == 413
    assert respuesta.json() == {"detail": "La petición es demasiado grande"}


def test_sin_documentacion_en_produccion(web: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # La documentación de la API se apaga con APP_MODO=produccion (lo pone el lanzador).
    assert web.get("/docs").text == "<html>app</html>"  # en la raíz solo está la web


def test_bloqueos_crecientes(cliente_sin_sesion: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    cliente_sin_sesion.post("/auth/registro", json={"usuario": "rodrigo", "contrasena": "secreta123"})
    malos = {"usuario": "rodrigo", "contrasena": "incorrecta"}
    for _ in range(acceso._MAX_FALLOS):
        cliente_sin_sesion.post("/auth/login", json=malos)
    assert cliente_sin_sesion.post("/auth/login", json=malos).status_code == 429

    # Pasado el primer bloqueo, otros 5 fallos bloquean el doble de tiempo.
    monkeypatch.setattr(acceso, "_bloqueado_hasta", 0.0)
    for _ in range(acceso._MAX_FALLOS):
        cliente_sin_sesion.post("/auth/login", json=malos)
    detalle = cliente_sin_sesion.post("/auth/login", json=malos).json()["detail"]
    assert "120 s" in detalle or "119 s" in detalle


def test_cambiar_contrasena_tambien_tiene_freno(cliente_sin_sesion: TestClient) -> None:
    cliente_sin_sesion.post("/auth/registro", json={"usuario": "rodrigo", "contrasena": "secreta123"})
    datos = {"actual": "incorrecta", "nueva": "otraclave123"}
    for _ in range(acceso._MAX_FALLOS):
        assert cliente_sin_sesion.post("/auth/cambiar-contrasena", json=datos).status_code == 400
    assert cliente_sin_sesion.post("/auth/cambiar-contrasena", json=datos).status_code == 429


@pytest.fixture
def desarrollo(cliente_sin_sesion: TestClient) -> TestClient:
    """La API como en `docker compose` (PROTECCION_LOCAL=true), vista a través del proxy de Vite."""
    return TestClient(ProteccionLocal(app, con_cabeceras=False), base_url="http://localhost:5173")


def test_desarrollo_rechaza_host_y_origen_ajenos(desarrollo: TestClient) -> None:
    assert desarrollo.get("/health", headers={"host": "evil.com"}).status_code == 400
    datos = {"usuario": "x", "contrasena": "12345678"}
    assert desarrollo.post("/auth/login", json=datos, headers={"origin": "http://evil.com"}).status_code == 403
    # Otra app del mismo ordenador (otro puerto) tampoco: la cookie "lax" sí le llegaría.
    assert desarrollo.post("/auth/login", json=datos, headers={"origin": "http://localhost:3000"}).status_code == 403


def test_desarrollo_deja_pasar_a_la_propia_app(desarrollo: TestClient) -> None:
    datos = {"usuario": "x", "contrasena": "12345678"}
    # Llega al login (401: no hay usuario), no lo frena la defensa.
    assert desarrollo.post("/auth/login", json=datos, headers={"origin": "http://localhost:5173"}).status_code == 401
    # Sin CSP: la web la sirve Vite y /docs carga sus scripts de un CDN.
    assert "content-security-policy" not in desarrollo.get("/health").headers
