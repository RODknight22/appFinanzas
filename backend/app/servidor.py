"""Aplicación de producción: la API bajo /api y la web ya compilada en /.

En desarrollo, Vite sirve la web y reenvía /api al backend. Al publicar no hay
Vite: este módulo une las dos cosas en un solo servidor y un solo puerto.
La API (app.main) no cambia, así que los tests siguen usándola tal cual.
"""

import os
from pathlib import Path

from fastapi import FastAPI
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from app.main import app as api
from app.main import lifespan
from app.seguridad_http import ProteccionLocal

# Carpeta con el resultado de `npm run build` (index.html + assets/).
FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", Path(__file__).resolve().parents[2] / "frontend" / "dist"))


class WebDeUnaPagina(StaticFiles):
    """Sirve la web compilada; cualquier ruta desconocida devuelve index.html.

    La app es de una sola página (React Router): /dashboard o /metas no existen
    como archivos, los resuelve el navegador. Sin esto, recargar en /metas daría 404.
    """

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            respuesta = await super().get_response(path, scope)
        except HTTPException as error:
            # Un archivo de assets/ que no existe (p. ej. de una versión anterior) no es una
            # ruta de la app: devolver index.html con caché de un año rompería esa pestaña.
            if error.status_code != 404 or path.startswith("assets/"):
                raise
            respuesta = await super().get_response("index.html", scope)
        if path.startswith("assets/"):
            # Vite pone un hash en el nombre de estos archivos: si cambian, cambia
            # el nombre, así que el navegador puede guardarlos para siempre.
            respuesta.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            # index.html siempre se revalida: así una versión nueva se ve al instante.
            respuesta.headers["Cache-Control"] = "no-cache"
        return respuesta


def crear_aplicacion(frontend_dir: Path = FRONTEND_DIR) -> FastAPI:
    # Las apps montadas no ejecutan su propio lifespan: lo ejecuta esta.
    web = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    # Sin GZip: entre el navegador y 127.0.0.1 no hay red; comprimir solo gastaría CPU.
    web.add_middleware(ProteccionLocal)
    web.mount("/api", api)
    if not (frontend_dir / "index.html").exists():
        raise RuntimeError(f"No se encontró la web compilada en {frontend_dir}. Ejecuta `npm run build`.")
    web.mount("/", WebDeUnaPagina(directory=frontend_dir, html=True), name="web")
    return web
