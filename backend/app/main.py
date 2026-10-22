"""Punto de entrada de la API: crea la app, registra routers y manejadores de error."""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse

from app.database import init_db
from app.dependencias import requiere_sesion
from app.routers import (
    acceso,
    categorias,
    configuracion,
    copias,
    cuentas,
    dashboard,
    deseos,
    deudas,
    importaciones,
    ingresos_recurrentes,
    metas,
    notificaciones,
    presupuestos,
    suscripciones,
    transacciones,
    transferencias,
)
from app.services.errores import ErrorDeDominio
from app.version import VERSION


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Se ejecuta una vez al arrancar: garantiza que las tablas existen."""
    init_db()
    yield


# En producción (ejecutable o Docker) no se publica la documentación interactiva:
# el usuario no la necesita y revela toda la API. En desarrollo sigue en /docs.
PRODUCCION = os.getenv("APP_MODO") == "produccion"

# Sin CORS: la web siempre llega por el mismo origen (proxy de Vite en desarrollo,
# el propio servidor en producción), así que el navegador nunca lo necesita.
app = FastAPI(
    title="Finanzas Personales API",
    version=VERSION,
    lifespan=lifespan,
    docs_url=None if PRODUCCION else "/docs",
    redoc_url=None if PRODUCCION else "/redoc",
    openapi_url=None if PRODUCCION else "/openapi.json",
)


@app.exception_handler(ErrorDeDominio)
async def manejar_error_de_dominio(_request: Request, exc: ErrorDeDominio) -> JSONResponse:
    """Traduce los errores de los servicios a HTTP con el mismo formato que FastAPI."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.mensaje})


# Público: lo necesario para iniciar sesión.
app.include_router(acceso.router)

# Protegido: todos los datos exigen una sesión válida (si no, 401).
# Añadir la dependencia aquí evita olvidarla en algún endpoint concreto.
for modulo in (
    cuentas, categorias, transacciones, transferencias, presupuestos, suscripciones, metas, dashboard,
    configuracion, importaciones, ingresos_recurrentes, deudas, deseos, notificaciones, copias,
):
    app.include_router(modulo.router, dependencies=[Depends(requiere_sesion)])


@app.get("/health", tags=["Sistema"])
def health() -> dict[str, str]:
    """Comprobación rápida de que la API está viva (Docker y el lanzador la usan)."""
    return {"status": "ok", "app": "appfinanzas", "version": VERSION}


if not PRODUCCION:

    @app.get("/", include_in_schema=False)
    def raiz() -> RedirectResponse:
        """En desarrollo la raíz no tiene contenido propio: lleva a la documentación."""
        return RedirectResponse(url="/docs")
