"""Endpoints HTTP de presupuestos."""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.database import SessionDep
from app.schemas import PresupuestoCreate, PresupuestoRead, PresupuestoUpdate
from app.services import presupuestos as servicio

router = APIRouter(prefix="/presupuestos", tags=["Presupuestos"])


@router.get("", response_model=list[PresupuestoRead])
def listar_presupuestos(
    session: SessionDep,
    mes_anio: Annotated[str | None, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")] = None,
    categoria_id: int | None = None,
):
    """Lista presupuestos; `?mes_anio=2026-10` muestra solo los de ese mes."""
    return servicio.listar(session, mes_anio, categoria_id)


@router.get("/{presupuesto_id}", response_model=PresupuestoRead)
def obtener_presupuesto(presupuesto_id: int, session: SessionDep):
    return servicio.obtener(session, presupuesto_id)


@router.post("", response_model=PresupuestoRead, status_code=status.HTTP_201_CREATED)
def crear_presupuesto(datos: PresupuestoCreate, session: SessionDep):
    return servicio.crear(session, datos)


@router.patch("/{presupuesto_id}", response_model=PresupuestoRead)
def actualizar_presupuesto(presupuesto_id: int, cambios: PresupuestoUpdate, session: SessionDep):
    return servicio.actualizar(session, presupuesto_id, cambios)


@router.delete("/{presupuesto_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_presupuesto(presupuesto_id: int, session: SessionDep) -> None:
    servicio.eliminar(session, presupuesto_id)
