"""Endpoints de las preferencias de la app y de las tasas de cambio."""

from fastapi import APIRouter

from app.database import SessionDep
from app.models import Moneda
from app.schemas import ConfiguracionRead, ConfiguracionUpdate, TasaManual, TasaRead
from app.services import configuracion as servicio
from app.services import divisas

router = APIRouter(tags=["Configuración"])


@router.get("/configuracion", response_model=ConfiguracionRead)
def obtener_configuracion(session: SessionDep):
    return servicio.obtener(session)


@router.patch("/configuracion", response_model=ConfiguracionRead)
def actualizar_configuracion(cambios: ConfiguracionUpdate, session: SessionDep):
    """Cambia la moneda principal, las monedas activas o la personalización.

    Cambiar la principal recalcula los importes de todas las transacciones
    con la tasa histórica de su fecha.
    """
    return servicio.actualizar(session, cambios)


@router.get("/tasas", response_model=list[TasaRead])
def listar_tasas(session: SessionDep):
    """Cuánto vale 1 unidad de cada moneda en la principal. Descarga las de hoy si faltan."""
    divisas.asegurar_tasas_del_dia(session)
    return divisas.tasas_vigentes(session, servicio.moneda_principal(session))


@router.post("/tasas/actualizar", response_model=list[TasaRead])
def actualizar_tasas(session: SessionDep):
    """Fuerza la descarga desde internet (503 si no hay conexión)."""
    divisas.actualizar_desde_internet(session)
    return divisas.tasas_vigentes(session, servicio.moneda_principal(session))


@router.put("/tasas/{moneda}", response_model=list[TasaRead])
def fijar_tasa(moneda: Moneda, datos: TasaManual, session: SessionDep):
    """Escribe a mano la tasa de hoy ("1 EUR = 21 MXN"); la descarga automática no la pisa.

    Devuelve todas las tasas, porque con el USD una tasa manual puede mover otras.
    """
    principal = servicio.moneda_principal(session)
    divisas.fijar_tasa_en_principal(session, moneda, datos.en_principal, principal)
    return divisas.tasas_vigentes(session, principal)
