"""Preferencias de la app: monedas y personalización."""

import base64
import binascii
import hashlib
import json
from collections.abc import Callable

from sqlmodel import Session

from app.models import ColorAcento, Configuracion, EstiloVisual, Moneda, PaginaInicio
from app.schemas import ConfiguracionRead, ConfiguracionUpdate, WidgetDisposicion
from app.services import divisas
from app.services.comun import guardar
from app.services.errores import ReglaDeNegocioError

# El estilo personalizado empieza con el tono y la intensidad de Fintech (index.css).
TINTE_POR_DEFECTO = 275
VIVEZA_POR_DEFECTO = 100


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
        estilo_visual=configuracion.estilo_visual or EstiloVisual.FINTECH,
        # `is None`: 0 es un valor válido (rojo / gris puro), no "sin elegir".
        tinte_personal=TINTE_POR_DEFECTO if configuracion.tinte_personal is None else configuracion.tinte_personal,
        viveza_personal=VIVEZA_POR_DEFECTO if configuracion.viveza_personal is None else configuracion.viveza_personal,
        pagina_inicio=configuracion.pagina_inicio or PaginaInicio.DASHBOARD,
        dia_inicio_mes=configuracion.dia_inicio_mes or 1,
        widgets=widgets,
        foto_version=hashlib.sha256(configuracion.foto).hexdigest()[:12] if configuracion.foto else None,
        tutorial_visto=bool(configuracion.tutorial_visto),
        bienvenida_cerrada=bool(configuracion.bienvenida_cerrada),
        mostrar_consejos=configuracion.mostrar_consejos is not False,
        recordatorio_diario=bool(configuracion.recordatorio_diario),
        hora_recordatorio=_hora_recordatorio(configuracion),
        correo_recordatorios=configuracion.correo_recordatorios,
    )


HORA_RECORDATORIO_POR_DEFECTO = 21


def _hora_recordatorio(configuracion: Configuracion) -> int:
    hora = configuracion.hora_recordatorio
    return HORA_RECORDATORIO_POR_DEFECTO if hora is None else hora


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

    # Texto libre: un texto vacío equivale a "sin nombre", "sin avatar" o "sin correo".
    for campo in ("nombre", "avatar", "correo_recordatorios"):
        if campo in enviados:
            setattr(configuracion, campo, (enviados[campo] or "").strip() or None)

    for campo in (
        "color_acento", "estilo_visual", "tinte_personal", "viveza_personal", "pagina_inicio", "dia_inicio_mes",
        "tutorial_visto", "bienvenida_cerrada",
        "mostrar_consejos", "recordatorio_diario", "hora_recordatorio",
    ):
        if enviados.get(campo) is not None:
            setattr(configuracion, campo, enviados[campo])

    if "widgets" in enviados:
        # Se guarda como JSON; null vuelve a la disposición por defecto.
        configuracion.widgets = (
            json.dumps([w.model_dump(mode="json") for w in cambios.widgets]) if cambios.widgets else None
        )

    return _a_lectura(guardar(session, configuracion))


# ---------------------------------------------------------------------------
# Foto de perfil
# ---------------------------------------------------------------------------
_MAX_BYTES_FOTO = 300 * 1024
# Los primeros bytes de un archivo delatan su formato real ("números mágicos"):
# así no nos fiamos solo de lo que diga el texto "data:image/...".
_FIRMAS: dict[str, Callable[[bytes], bool]] = {
    "image/jpeg": lambda d: d.startswith(b"\xff\xd8\xff"),
    "image/png": lambda d: d.startswith(b"\x89PNG\r\n\x1a\n"),
    # WebP: "RIFF" + tamaño (4 bytes) + "WEBP" (un WAV también empieza por RIFF).
    "image/webp": lambda d: d[:4] == b"RIFF" and d[8:12] == b"WEBP",
}


def guardar_foto(session: Session, data_url: str) -> ConfiguracionRead:
    """Guarda una foto enviada como data URL ("data:image/jpeg;base64,...")."""
    cabecera, separador, contenido = data_url.partition(",")
    tipo = cabecera.removeprefix("data:").removesuffix(";base64")
    if not separador or not cabecera.endswith(";base64") or tipo not in _FIRMAS:
        raise ReglaDeNegocioError("La foto debe ser una imagen JPEG, PNG o WebP")
    try:
        datos = base64.b64decode(contenido, validate=True)
    except (binascii.Error, ValueError) as e:
        raise ReglaDeNegocioError("La imagen está dañada") from e
    if len(datos) > _MAX_BYTES_FOTO:
        raise ReglaDeNegocioError("La foto es demasiado grande (máximo 300 KB)")
    if not _FIRMAS[tipo](datos):
        raise ReglaDeNegocioError("El contenido no coincide con el tipo de imagen indicado")

    configuracion = _obtener_fila(session)
    configuracion.foto, configuracion.foto_tipo = datos, tipo
    return _a_lectura(guardar(session, configuracion))


def obtener_foto(session: Session) -> tuple[bytes, str] | None:
    configuracion = _obtener_fila(session)
    if configuracion.foto is None or configuracion.foto_tipo is None:
        return None
    return configuracion.foto, configuracion.foto_tipo


def borrar_foto(session: Session) -> ConfiguracionRead:
    configuracion = _obtener_fila(session)
    configuracion.foto = configuracion.foto_tipo = None
    return _a_lectura(guardar(session, configuracion))
