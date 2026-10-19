"""Endpoints HTTP de transferencias entre cuentas."""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.database import SessionDep
from app.schemas import TransferenciaCreate, TransferenciaRead, TransferenciaUpdate
from app.services import transferencias as servicio

router = APIRouter(prefix="/transferencias", tags=["Transferencias"])


@router.get("", response_model=list[TransferenciaRead])
def listar_transferencias(
    session: SessionDep,
    cuenta_id: int | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
):
    """Lista transferencias, de la más reciente a la más antigua."""
    return servicio.listar(session, cuenta_id=cuenta_id, offset=offset, limit=limit)


@router.get("/{transferencia_id}", response_model=TransferenciaRead)
def obtener_transferencia(transferencia_id: int, session: SessionDep):
    return servicio.obtener(session, transferencia_id)


@router.post("", response_model=TransferenciaRead, status_code=status.HTTP_201_CREATED)
def crear_transferencia(datos: TransferenciaCreate, session: SessionDep):
    return servicio.crear(session, datos)


@router.patch("/{transferencia_id}", response_model=TransferenciaRead)
def actualizar_transferencia(transferencia_id: int, cambios: TransferenciaUpdate, session: SessionDep):
    return servicio.actualizar(session, transferencia_id, cambios)


@router.delete("/{transferencia_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_transferencia(transferencia_id: int, session: SessionDep) -> None:
    servicio.eliminar(session, transferencia_id)
