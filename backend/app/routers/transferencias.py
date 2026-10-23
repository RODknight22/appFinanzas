"""Endpoints HTTP de transferencias entre cuentas."""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.database import SessionDep
from app.schemas import CosteEnviosAnio, TransferenciaCreate, TransferenciaRead, TransferenciaUpdate
from app.services import transferencias as servicio

router = APIRouter(prefix="/transferencias", tags=["Transferencias"])


@router.get("", response_model=list[TransferenciaRead])
def listar_transferencias(
    session: SessionDep,
    cuenta_id: int | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
):
    """Lista transferencias, de la más reciente a la más antigua, con el coste de los envíos."""
    return servicio.con_coste(session, servicio.listar(session, cuenta_id=cuenta_id, offset=offset, limit=limit))


# Antes que "/{transferencia_id}": si no, "costes" se tomaría por un id.
@router.get("/costes", response_model=CosteEnviosAnio)
def coste_de_los_envios(session: SessionDep, anio: Annotated[int, Query(ge=1999, le=2100)]):
    """Lo que costaron los envíos entre monedas de un año, frente a la tasa del BCE."""
    return servicio.coste_del_anio(session, anio)


@router.get("/{transferencia_id}", response_model=TransferenciaRead)
def obtener_transferencia(transferencia_id: int, session: SessionDep):
    return servicio.con_coste(session, [servicio.obtener(session, transferencia_id)])[0]


@router.post("", response_model=TransferenciaRead, status_code=status.HTTP_201_CREATED)
def crear_transferencia(datos: TransferenciaCreate, session: SessionDep):
    return servicio.con_coste(session, [servicio.crear(session, datos)])[0]


@router.patch("/{transferencia_id}", response_model=TransferenciaRead)
def actualizar_transferencia(transferencia_id: int, cambios: TransferenciaUpdate, session: SessionDep):
    return servicio.con_coste(session, [servicio.actualizar(session, transferencia_id, cambios)])[0]


@router.delete("/{transferencia_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_transferencia(transferencia_id: int, session: SessionDep) -> None:
    servicio.eliminar(session, transferencia_id)
