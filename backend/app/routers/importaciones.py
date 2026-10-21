"""Endpoints HTTP para importar extractos bancarios."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.database import SessionDep
from app.schemas import ImportacionCreate, ResultadoImportacion, VistaPreviaImportacion
from app.services import importaciones as servicio

router = APIRouter(prefix="/importaciones", tags=["Importaciones"])


async def _archivo(request: Request) -> bytes:
    """El archivo llega tal cual en el cuerpo: así no hace falta otra dependencia para formularios."""
    return await request.body()


@router.post(
    "/vista-previa",
    response_model=VistaPreviaImportacion,
    # Para que /docs muestre que el cuerpo es un archivo y no JSON.
    openapi_extra={"requestBody": {"content": {"application/octet-stream": {"schema": {"type": "string", "format": "binary"}}}}},
)
def vista_previa(
    cuenta_id: int, contenido: Annotated[bytes, Depends(_archivo)], session: SessionDep, invertir_signos: bool = False
):
    """Lee un extracto (CSV o .xlsx) y devuelve lo que se importaría. No guarda nada."""
    return servicio.vista_previa(session, cuenta_id, contenido, invertir_signos)


@router.post("", response_model=ResultadoImportacion, status_code=status.HTTP_201_CREATED)
def importar(datos: ImportacionCreate, session: SessionDep):
    """Crea las transacciones aceptadas en la vista previa (todas o ninguna)."""
    return servicio.confirmar(session, datos)
