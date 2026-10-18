"""Preferencias de la app: monedas y personalización."""

import json

from sqlmodel import Session

from app.models import ColorAcento, Configuracion, Moneda, PaginaInicio
from app.schemas import ConfiguracionRead, ConfiguracionUpdate, WidgetDisposicion
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


def dia_inicio_mes(session: Session) -> int:
    return _obtener_fila(session).dia_inicio_mes or 1


def comprobar_moneda_activa(session: Session, moneda: Moneda) -> None:
    """Las monedas desactivadas no se ofrecen para registros nuevos."""
    if moneda not in monedas_activas(_obtener_fila(session)):
        raise ReglaDeNegocioError(f"La moneda {moneda.value} está desactivada. Actívala en Ajustes.")


def _a_lectura(configuracion: Configuracion) -> ConfiguracionRead:
    """Rellena los valores por defecto de lo que aún no se ha personalizado."""
    widgets = None
    if configuracion.widgets:
        widgets = [WidgetDisposicion.model_validate(w) for w in json.loads(configuracion.widgets)]
    return ConfiguracionRead(
        moneda=configuracion.moneda,
        monedas_activas=monedas_activas(configuracion),
        nombre=configuracion.nombre,
        avatar=configuracion.avatar,
        color_acento=configuracion.color_acento or ColorAcento.ESMERALDA,
        pagina_inicio=configuracion.pagina_inicio or PaginaInicio.DASHBOARD,
        dia_inicio_mes=configuracion.dia_inicio_mes or 1,
        widgets=widgets,
    )


def obtener(session: Session) -> ConfiguracionRead:
    return _a_lectura(_obtener_fila(session))


def _actualizar_monedas(session: Session, configuracion: Configuracion, cambios: ConfiguracionUpdate) -> None:
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


def actualizar(session: Session, cambios: ConfiguracionUpdate) -> ConfiguracionRead:
    configuracion = _obtener_fila(session)
    enviados = cambios.model_dump(exclude_unset=True)

    if "moneda" in enviados or "monedas_activas" in enviados:
        _actualizar_monedas(session, configuracion, cambios)

    # Texto libre: un texto vacío equivale a "sin nombre" / "sin avatar".
    for campo in ("nombre", "avatar"):
        if campo in enviados:
            setattr(configuracion, campo, (enviados[campo] or "").strip() or None)

    for campo in ("color_acento", "pagina_inicio", "dia_inicio_mes"):
        if enviados.get(campo) is not None:
            setattr(configuracion, campo, enviados[campo])

    if "widgets" in enviados:
        # Se guarda como JSON; null vuelve a la disposición por defecto.
        configuracion.widgets = (
            json.dumps([w.model_dump(mode="json") for w in cambios.widgets]) if cambios.widgets else None
        )

    return _a_lectura(guardar(session, configuracion))
