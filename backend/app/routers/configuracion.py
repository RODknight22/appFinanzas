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
    """Cambia la moneda principal y/o las monedas activas.

    Cambiar la principal recalcula los importes de todas las transacciones
    con la tasa histórica de su fecha.
    """
    return servicio.actualizar(session, cambios)


@router.get("/tasas", response_model=list[TasaRead])
def listar_tasas(session: SessionDep):
    """Tasa vigente de cada moneda (unidades por 1 USD). Descarga las de hoy si faltan."""
    divisas.asegurar_tasas_del_dia(session)
    return divisas.tasas_vigentes(session)


@router.post("/tasas/actualizar", response_model=list[TasaRead])
def actualizar_tasas(session: SessionDep):
    """Fuerza la descarga desde internet (503 si no hay conexión)."""
    divisas.actualizar_desde_internet(session)
    return divisas.tasas_vigentes(session)


@router.put("/tasas/{moneda}", response_model=TasaRead)
def fijar_tasa(moneda: Moneda, datos: TasaManual, session: SessionDep):
    """Escribe a mano la tasa de hoy; la descarga automática no la sobrescribe."""
    return divisas.fijar_tasa_manual(session, moneda, datos.por_usd)
