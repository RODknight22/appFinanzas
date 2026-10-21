"""Endpoints HTTP de ingresos recurrentes."""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.database import SessionDep
from app.schemas import (
    CobroIngresoCreate,
    CobroIngresoRead,
    IngresoRecurrenteCreate,
    IngresoRecurrenteRead,
    IngresoRecurrenteUpdate,
    TransaccionRead,
)
from app.services import ingresos_recurrentes as servicio

router = APIRouter(prefix="/ingresos-recurrentes", tags=["Ingresos recurrentes"])


@router.get("", response_model=list[IngresoRecurrenteRead])
def listar_ingresos(
    session: SessionDep,
    proximos_dias: Annotated[int | None, Query(ge=0, le=366)] = None,
):
    """Lista por próximo cobro; `?proximos_dias=7` muestra los que llegan pronto o van atrasados."""
    return servicio.listar(session, proximos_dias)


@router.get("/{ingreso_id}", response_model=IngresoRecurrenteRead)
def obtener_ingreso(ingreso_id: int, session: SessionDep):
    return servicio.obtener(session, ingreso_id)


@router.post("", response_model=IngresoRecurrenteRead, status_code=status.HTTP_201_CREATED)
def crear_ingreso(datos: IngresoRecurrenteCreate, session: SessionDep):
    return servicio.crear(session, datos)


@router.patch("/{ingreso_id}", response_model=IngresoRecurrenteRead)
def actualizar_ingreso(ingreso_id: int, cambios: IngresoRecurrenteUpdate, session: SessionDep):
    return servicio.actualizar(session, ingreso_id, cambios)


@router.delete("/{ingreso_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_ingreso(ingreso_id: int, session: SessionDep) -> None:
    servicio.eliminar(session, ingreso_id)


@router.post(
    "/{ingreso_id}/registrar-cobro",
    response_model=CobroIngresoRead,
    status_code=status.HTTP_201_CREATED,
)
def registrar_cobro(ingreso_id: int, datos: CobroIngresoCreate, session: SessionDep):
    """Crea la transacción de ingreso y avanza la fecha al siguiente periodo."""
    transaccion, ingreso = servicio.registrar_cobro(session, ingreso_id, datos)
    return CobroIngresoRead(
        transaccion=TransaccionRead.model_validate(transaccion),
        ingreso=IngresoRecurrenteRead.model_validate(ingreso),
    )


@router.post("/{ingreso_id}/omitir", response_model=IngresoRecurrenteRead)
def omitir_cobro(ingreso_id: int, session: SessionDep):
    """Pasa al siguiente periodo sin anotar ningún ingreso."""
    return servicio.omitir_cobro(session, ingreso_id)
