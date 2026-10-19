"""Punto de entrada del ejecutable: arranca el servidor local y abre el navegador.

Doble clic en el ejecutable → se abre la app. La ventana de consola que queda
abierta ES la app: al cerrarla, la app se detiene.

Uso:
    AppFinanzas                           abre la app
    AppFinanzas --restablecer-contrasena  borra el usuario (contraseña olvidada)
"""

import json
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

NOMBRE = "AppFinanzas"
PUERTO_PREFERIDO = 8765
HOST = "127.0.0.1"  # solo este ordenador: nadie de la red puede conectarse


def carpeta_de_datos() -> Path:
    """Donde cada sistema guarda los datos de las apps del usuario (no junto al ejecutable,
    que puede estar en Descargas o sin permisos de escritura)."""
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home()))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / NOMBRE


def carpeta_web() -> Path:
    """La web compilada: dentro del ejecutable (PyInstaller la descomprime en
    sys._MEIPASS) o, sin empaquetar, la de frontend/dist del repositorio."""
    empaquetada = getattr(sys, "_MEIPASS", None)
    if empaquetada:
        return Path(empaquetada) / "web"
    return Path(__file__).resolve().parents[2] / "frontend" / "dist"


def _es_nuestra_app(puerto: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://{HOST}:{puerto}/api/health", timeout=1) as respuesta:
            return json.load(respuesta).get("app") == "appfinanzas"
    except (OSError, ValueError):
        return False


def _puerto_libre(preferido: int) -> int:
    """El puerto de siempre si está libre (así los marcadores del navegador funcionan);
    si no, uno cualquiera que el sistema nos dé."""
    for puerto in (preferido, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as prueba:
            try:
                prueba.bind((HOST, puerto))
                return prueba.getsockname()[1]
            except OSError:
                continue
    raise RuntimeError("No hay ningún puerto libre")


def _abrir_navegador_cuando_este_lista(url: str, puerto: int) -> None:
    for _ in range(150):  # hasta ~30 s (la primera vez descomprime y crea la BD)
        if _es_nuestra_app(puerto):
            webbrowser.open(url)
            return
        time.sleep(0.2)


def main() -> None:
    # La consola de Windows no siempre entiende UTF-8: que una tilde no tumbe la app.
    for flujo in (sys.stdout, sys.stderr):
        if hasattr(flujo, "reconfigure"):
            flujo.reconfigure(encoding="utf-8", errors="replace")

    datos = carpeta_de_datos()
    # 0o700: en Linux/macOS, solo tu usuario puede entrar en la carpeta de tus finanzas.
    datos.mkdir(mode=0o700, parents=True, exist_ok=True)
    archivo_puerto = datos / "puerto.txt"
    # Antes de importar la app: database.py lee DATA_DIR al cargarse.
    os.environ.setdefault("DATA_DIR", str(datos))
    os.environ.setdefault("FRONTEND_DIR", str(carpeta_web()))

    if "--restablecer-contrasena" in sys.argv:
        from app.restablecer_contrasena import main as restablecer

        restablecer()
        return

    # ¿Ya está abierta? Entonces solo abrimos otra pestaña (dos servidores sobre
    # la misma base de datos no tienen sentido).
    try:
        anterior = int(archivo_puerto.read_text())
    except (OSError, ValueError):  # primera vez, o archivo dañado
        anterior = PUERTO_PREFERIDO
    if _es_nuestra_app(anterior):
        webbrowser.open(f"http://{HOST}:{anterior}")
        return

    import uvicorn

    from app.servidor import crear_aplicacion
    from app.version import VERSION

    puerto = _puerto_libre(PUERTO_PREFERIDO)
    archivo_puerto.write_text(str(puerto))
    url = f"http://{HOST}:{puerto}"
    print(f"Finanzas Personales {VERSION}")
    print(f"  Abierta en {url}")
    print(f"  Tus datos: {datos}")
    print("  Cierra esta ventana para detener la app.\n")
    threading.Thread(target=_abrir_navegador_cuando_este_lista, args=(url, puerto), daemon=True).start()
    uvicorn.run(crear_aplicacion(), host=HOST, port=puerto, log_level="warning")


if __name__ == "__main__":
    main()
