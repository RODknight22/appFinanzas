"""Endpoints de las preferencias de la app y de las tasas de cambio."""

from fastapi import APIRouter, Response

from app.database import SessionDep
from app.models import Moneda
from app.schemas import ConfiguracionRead, ConfiguracionUpdate, FotoPerfil, TasaManual, TasaRead
from app.services import configuracion as servicio
from app.services import divisas
from app.services.errores import NoEncontradoError

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


@router.put("/configuracion/foto", response_model=ConfiguracionRead)
def subir_foto(datos: FotoPerfil, session: SessionDep):
    """Sube la foto de perfil (el navegador ya la recortó a 256×256 y la comprimió)."""
    return servicio.guardar_foto(session, datos.imagen)


@router.get("/configuracion/foto", response_class=Response)
def ver_foto(session: SessionDep) -> Response:
    """La imagen tal cual, para usarla en <img src=...>."""
    foto = servicio.obtener_foto(session)
    if foto is None:
        raise NoEncontradoError("No hay foto de perfil")
    contenido, tipo = foto
    # "private": solo la guarda este navegador. La URL lleva la versión (?v=…),
    # así que al cambiar de foto cambia la URL y no se ve la antigua.
    return Response(content=contenido, media_type=tipo, headers={"Cache-Control": "private, max-age=31536000"})


@router.delete("/configuracion/foto", response_model=ConfiguracionRead)
def borrar_foto(session: SessionDep):
    return servicio.borrar_foto(session)


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
