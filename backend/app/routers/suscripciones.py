"""Endpoints HTTP de suscripciones."""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.database import SessionDep
from app.schemas import (
    PagoSuscripcionCreate,
    PagoSuscripcionRead,
    SuscripcionCreate,
    SuscripcionRead,
    SuscripcionUpdate,
    TransaccionRead,
)
from app.services import suscripciones as servicio

router = APIRouter(prefix="/suscripciones", tags=["Suscripciones"])


@router.get("", response_model=list[SuscripcionRead])
def listar_suscripciones(
    session: SessionDep,
    proximos_dias: Annotated[int | None, Query(ge=0, le=366)] = None,
):
    """Lista suscripciones por próximo cobro; `?proximos_dias=7` muestra las que vencen pronto."""
    return servicio.listar(session, proximos_dias)


@router.get("/{suscripcion_id}", response_model=SuscripcionRead)
def obtener_suscripcion(suscripcion_id: int, session: SessionDep):
    return servicio.obtener(session, suscripcion_id)


@router.post("", response_model=SuscripcionRead, status_code=status.HTTP_201_CREATED)
def crear_suscripcion(datos: SuscripcionCreate, session: SessionDep):
    return servicio.crear(session, datos)


@router.patch("/{suscripcion_id}", response_model=SuscripcionRead)
def actualizar_suscripcion(suscripcion_id: int, cambios: SuscripcionUpdate, session: SessionDep):
    return servicio.actualizar(session, suscripcion_id, cambios)


@router.delete("/{suscripcion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_suscripcion(suscripcion_id: int, session: SessionDep) -> None:
    servicio.eliminar(session, suscripcion_id)


@router.post(
    "/{suscripcion_id}/registrar-pago",
    response_model=PagoSuscripcionRead,
    status_code=status.HTTP_201_CREATED,
)
def registrar_pago(suscripcion_id: int, datos: PagoSuscripcionCreate, session: SessionDep):
    """Crea la transacción de gasto del cobro y avanza la fecha al siguiente periodo."""
    transaccion, suscripcion = servicio.registrar_pago(session, suscripcion_id, datos)
    return PagoSuscripcionRead(
        transaccion=TransaccionRead.model_validate(transaccion),
        suscripcion=SuscripcionRead.model_validate(suscripcion),
    )
