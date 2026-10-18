"""Login de un solo usuario: alta, inicio/cierre de sesión y protección del API."""

from fastapi.testclient import TestClient

from app.seguridad import hash_contrasena, verificar_contrasena

DATOS = {"usuario": "rodrigo", "contrasena": "secreta123"}


def test_hash_de_contrasena() -> None:
    guardado = hash_contrasena("secreta123")
    assert "secreta123" not in guardado  # nunca en claro
    assert verificar_contrasena("secreta123", guardado)
    assert not verificar_contrasena("otra", guardado)
    assert hash_contrasena("secreta123") != guardado  # la sal cambia cada vez


def test_sin_sesion_el_api_responde_401(cliente_sin_sesion: TestClient) -> None:
    assert cliente_sin_sesion.get("/cuentas").status_code == 401
    assert cliente_sin_sesion.get("/dashboard/resumen").status_code == 401
    assert cliente_sin_sesion.get("/health").status_code == 200  # público


def test_primer_uso_registro_y_acceso(cliente_sin_sesion: TestClient) -> None:
    assert cliente_sin_sesion.get("/auth/estado").json() == {
        "configurado": False, "autenticado": False, "usuario": None,
    }
    respuesta = cliente_sin_sesion.post("/auth/registro", json=DATOS)
    assert respuesta.status_code == 201
    cookie = respuesta.headers["set-cookie"]
    assert "sesion=" in cookie and "HttpOnly" in cookie

    # TestClient guarda la cookie como un navegador: ya hay acceso
    assert cliente_sin_sesion.get("/cuentas").status_code == 200
    assert cliente_sin_sesion.get("/auth/estado").json()["autenticado"] is True


def test_solo_puede_haber_un_usuario(cliente_sin_sesion: TestClient) -> None:
    cliente_sin_sesion.post("/auth/registro", json=DATOS)
    otro = {"usuario": "intruso", "contrasena": "12345678"}
    assert cliente_sin_sesion.post("/auth/registro", json=otro).status_code == 409


def test_contrasena_corta_al_registrar(cliente_sin_sesion: TestClient) -> None:
    corta = {"usuario": "rodrigo", "contrasena": "123"}
    assert cliente_sin_sesion.post("/auth/registro", json=corta).status_code == 422


def test_logout_y_login(cliente_sin_sesion: TestClient) -> None:
    cliente_sin_sesion.post("/auth/registro", json=DATOS)
    assert cliente_sin_sesion.post("/auth/logout").status_code == 204
    assert cliente_sin_sesion.get("/cuentas").status_code == 401

    mal = cliente_sin_sesion.post("/auth/login", json={**DATOS, "contrasena": "incorrecta"})
    assert mal.status_code == 401
    assert mal.json()["detail"] == "Usuario o contraseña incorrectos"

    assert cliente_sin_sesion.post("/auth/login", json=DATOS).status_code == 200
    assert cliente_sin_sesion.get("/cuentas").status_code == 200


def test_bloqueo_tras_varios_fallos(cliente_sin_sesion: TestClient) -> None:
    cliente_sin_sesion.post("/auth/registro", json=DATOS)
    cliente_sin_sesion.post("/auth/logout")
    malos = {**DATOS, "contrasena": "incorrecta"}
    codigos = [cliente_sin_sesion.post("/auth/login", json=malos).status_code for _ in range(6)]
    assert codigos == [401, 401, 401, 401, 401, 429]
    # Bloqueado incluso con la contraseña correcta
    assert cliente_sin_sesion.post("/auth/login", json=DATOS).status_code == 429


def test_cambiar_contrasena(cliente_sin_sesion: TestClient) -> None:
    cliente_sin_sesion.post("/auth/registro", json=DATOS)
    mal = {"actual": "noesesta", "nueva": "nuevaclave1"}
    assert cliente_sin_sesion.post("/auth/cambiar-contrasena", json=mal).status_code == 400

    bien = {"actual": DATOS["contrasena"], "nueva": "nuevaclave1"}
    assert cliente_sin_sesion.post("/auth/cambiar-contrasena", json=bien).status_code == 204
    cliente_sin_sesion.post("/auth/logout")
    assert cliente_sin_sesion.post("/auth/login", json=DATOS).status_code == 401
    assert cliente_sin_sesion.post("/auth/login", json={**DATOS, "contrasena": "nuevaclave1"}).status_code == 200
