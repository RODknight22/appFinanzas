"""Punto de entrada de la API: crea la app, registra routers y manejadores de error."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from app.database import init_db
from app.routers import categorias, cuentas, presupuestos, transacciones
from app.services.errores import ErrorDeDominio


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Se ejecuta una vez al arrancar: garantiza que las tablas existen."""
    init_db()
    yield


app = FastAPI(
    title="Finanzas Personales API",
    version="0.1.0",
    lifespan=lifespan,
)

# El frontend (Vite, puerto 5173) vive en otro origen; sin CORS el navegador
# bloquearía sus peticiones a esta API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ErrorDeDominio)
async def manejar_error_de_dominio(_request: Request, exc: ErrorDeDominio) -> JSONResponse:
    """Traduce los errores de los servicios a HTTP con el mismo formato que FastAPI."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.mensaje})


app.include_router(cuentas.router)
app.include_router(categorias.router)
app.include_router(transacciones.router)
app.include_router(presupuestos.router)


@app.get("/health", tags=["Sistema"])
def health() -> dict[str, str]:
    """Comprobación rápida de que la API está viva (útil para Docker)."""
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def raiz() -> RedirectResponse:
    """La raíz no tiene contenido propio: redirigimos a la documentación interactiva."""
    return RedirectResponse(url="/docs")
