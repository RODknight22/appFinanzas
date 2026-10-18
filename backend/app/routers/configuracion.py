"""Endpoints de las preferencias de la app."""

from fastapi import APIRouter

from app.database import SessionDep
from app.schemas import ConfiguracionRead, ConfiguracionUpdate
from app.services import configuracion as servicio

router = APIRouter(prefix="/configuracion", tags=["Configuración"])


@router.get("", response_model=ConfiguracionRead)
def obtener_configuracion(session: SessionDep):
    return servicio.obtener(session)


@router.put("", response_model=ConfiguracionRead)
def actualizar_configuracion(cambios: ConfiguracionUpdate, session: SessionDep):
    """Cambia la moneda con la que se muestran todos los importes."""
    return servicio.actualizar(session, cambios)
