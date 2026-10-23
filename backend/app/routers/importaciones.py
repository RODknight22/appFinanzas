"""Endpoints HTTP para importar extractos bancarios."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.database import SessionDep
from app.schemas import ImportacionCreate, ResultadoImportacion, VistaPreviaImportacion
from app.services import importaciones as servicio

router = APIRouter(prefix="/importaciones", tags=["Importaciones"])

# Años de extractos caben de sobra. El servidor de producción ya limita todo a 1 MB,
# pero en desarrollo no hay ese filtro: el tope aquí protege en los dos.
TAMANO_MAXIMO_ARCHIVO = 1_000_000


async def _archivo(request: Request) -> bytes:
    """El archivo llega tal cual en el cuerpo: así no hace falta otra dependencia para formularios.

    Se lee por trozos contando los bytes, para no cargar en memoria un archivo enorme.
    """
    trozos = bytearray()
    async for trozo in request.stream():
        trozos += trozo
        if len(trozos) > TAMANO_MAXIMO_ARCHIVO:
            raise HTTPException(413, "El archivo pasa de 1 MB: exporta un periodo más corto")
    return bytes(trozos)


@router.post(
    "/vista-previa",
    response_model=VistaPreviaImportacion,
    # Para que /docs muestre que el cuerpo es un archivo y no JSON.
    openapi_extra={"requestBody": {"content": {"application/octet-stream": {"schema": {"type": "string", "format": "binary"}}}}},
)
def vista_previa(
    cuenta_id: int,
    contenido: Annotated[bytes, Depends(_archivo)],
    session: SessionDep,
    invertir_signos: bool | None = None,
):
    """Lee un extracto (CSV, .xlsx o .xls) y devuelve lo que se importaría. No guarda nada.

    Sin `invertir_signos`, se usa lo que se eligió la última vez en esa cuenta.
    """
    return servicio.vista_previa(session, cuenta_id, contenido, invertir_signos)


@router.post("", response_model=ResultadoImportacion, status_code=status.HTTP_201_CREATED)
def importar(datos: ImportacionCreate, session: SessionDep):
    """Crea las transacciones y transferencias aceptadas en la vista previa (todas o ninguna)."""
    return servicio.confirmar(session, datos)
