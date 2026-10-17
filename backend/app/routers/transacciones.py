"""Endpoints HTTP de transacciones."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.database import SessionDep
from app.models import TipoMovimiento
from app.schemas import TransaccionCreate, TransaccionRead, TransaccionUpdate
from app.services import transacciones as servicio

router = APIRouter(prefix="/transacciones", tags=["Transacciones"])


@router.get("", response_model=list[TransaccionRead])
def listar_transacciones(
    session: SessionDep,
    desde: date | None = None,
    hasta: date | None = None,
    tipo: TipoMovimiento | None = None,
    cuenta_id: int | None = None,
    categoria_id: int | None = None,
    # Paginación: evita devolver miles de filas de golpe.
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
):
    """Lista transacciones, de la más reciente a la más antigua, con filtros opcionales."""
    return servicio.listar(
        session,
        desde=desde,
        hasta=hasta,
        tipo=tipo,
        cuenta_id=cuenta_id,
        categoria_id=categoria_id,
        offset=offset,
        limit=limit,
    )


@router.get("/{transaccion_id}", response_model=TransaccionRead)
def obtener_transaccion(transaccion_id: int, session: SessionDep):
    return servicio.obtener(session, transaccion_id)


@router.post("", response_model=TransaccionRead, status_code=status.HTTP_201_CREATED)
def crear_transaccion(datos: TransaccionCreate, session: SessionDep):
    return servicio.crear(session, datos)


@router.patch("/{transaccion_id}", response_model=TransaccionRead)
def actualizar_transaccion(transaccion_id: int, cambios: TransaccionUpdate, session: SessionDep):
    return servicio.actualizar(session, transaccion_id, cambios)


@router.delete("/{transaccion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_transaccion(transaccion_id: int, session: SessionDep) -> None:
    servicio.eliminar(session, transaccion_id)
