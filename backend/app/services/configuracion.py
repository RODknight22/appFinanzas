"""Preferencias de la app (de momento, solo la moneda)."""

from sqlmodel import Session

from app.models import Configuracion
from app.schemas import ConfiguracionUpdate
from app.services.comun import guardar


def obtener(session: Session) -> Configuracion:
    """Hay una única fila (id = 1); se crea si aún no existe."""
    configuracion = session.get(Configuracion, 1)
    if configuracion is None:
        configuracion = guardar(session, Configuracion(id=1))
    return configuracion


def actualizar(session: Session, cambios: ConfiguracionUpdate) -> Configuracion:
    configuracion = obtener(session)
    configuracion.sqlmodel_update(cambios.model_dump())
    return guardar(session, configuracion)
