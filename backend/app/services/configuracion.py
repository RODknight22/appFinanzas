"""Preferencias de la app: moneda principal y monedas activas."""

from sqlmodel import Session

from app.models import Configuracion, Moneda
from app.schemas import ConfiguracionRead, ConfiguracionUpdate
from app.services import divisas
from app.services.comun import guardar
from app.services.errores import ReglaDeNegocioError


def _obtener_fila(session: Session) -> Configuracion:
    """Hay una única fila (id = 1); se crea si aún no existe."""
    configuracion = session.get(Configuracion, 1)
    if configuracion is None:
        configuracion = guardar(session, Configuracion(id=1))
    return configuracion


def monedas_activas(configuracion: Configuracion) -> list[Moneda]:
    if not configuracion.monedas_activas:
        return list(Moneda)  # null = todas activas
    return [Moneda(codigo) for codigo in configuracion.monedas_activas.split(",")]


def moneda_principal(session: Session) -> Moneda:
    return _obtener_fila(session).moneda


def comprobar_moneda_activa(session: Session, moneda: Moneda) -> None:
    """Las monedas desactivadas no se ofrecen para registros nuevos."""
    if moneda not in monedas_activas(_obtener_fila(session)):
        raise ReglaDeNegocioError(f"La moneda {moneda.value} está desactivada. Actívala en Ajustes.")


def _a_lectura(configuracion: Configuracion) -> ConfiguracionRead:
    return ConfiguracionRead(moneda=configuracion.moneda, monedas_activas=monedas_activas(configuracion))


def obtener(session: Session) -> ConfiguracionRead:
    return _a_lectura(_obtener_fila(session))


def actualizar(session: Session, cambios: ConfiguracionUpdate) -> ConfiguracionRead:
    configuracion = _obtener_fila(session)
    principal = cambios.moneda or configuracion.moneda
    activas = cambios.monedas_activas if cambios.monedas_activas is not None else monedas_activas(configuracion)

    if not activas:
        raise ReglaDeNegocioError("Debe quedar al menos una moneda activa")
    if principal not in activas:
        raise ReglaDeNegocioError(f"La moneda principal ({principal.value}) tiene que estar activa")

    if principal != configuracion.moneda:
        divisas.asegurar_tasas_del_dia(session)
        # Si faltan tasas, esto lanza un error y no se guarda nada.
        divisas.recalcular_montos_principales(session, principal)

    configuracion.moneda = principal
    # Guardamos en el orden de Moneda para que la lista sea estable.
    configuracion.monedas_activas = ",".join(m.value for m in Moneda if m in activas)
    return _a_lectura(guardar(session, configuracion))
