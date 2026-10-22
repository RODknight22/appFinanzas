"""Endpoints HTTP de los avisos de la campana."""

from fastapi import APIRouter, status

from app.database import SessionDep
from app.schemas import MarcarLeidas, Notificacion
from app.services import notificaciones as servicio

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


@router.get("", response_model=list[Notificacion])
def listar_notificaciones(session: SessionDep):
    """Avisos de ahora mismo (pagos próximos, presupuestos, metas, deseos…), urgentes primero."""
    return servicio.listar(session)


@router.post("/leidas", status_code=status.HTTP_204_NO_CONTENT)
def marcar_leidas(datos: MarcarLeidas, session: SessionDep) -> None:
    servicio.marcar_leidas(session, datos.claves)
