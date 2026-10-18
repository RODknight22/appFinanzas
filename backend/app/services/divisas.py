"""Tasas de cambio y conversión entre monedas.

Todas las tasas se guardan respecto al dólar (unidades por 1 USD). Para
convertir entre dos monedas cualesquiera se pasa por el dólar:

    100 EUR → MXN = 100 / tasa(EUR) * tasa(MXN)

Las tasas se guardan por día. Para convertir una transacción se usa la tasa
de su fecha (o la más cercana anterior), de modo que un gasto de marzo
siempre vale lo mismo aunque hoy la tasa sea otra.
"""

import json
import logging
import os
import time
import urllib.request
from datetime import date
from decimal import Decimal

from sqlmodel import Session, col, select

from app.models import Moneda, OrigenTasa, TasaCambio, Transaccion
from app.services.errores import ReglaDeNegocioError, ServicioExternoError
from app.services.saldos import CENTIMOS

log = logging.getLogger(__name__)

# Servicio gratuito sin clave que incluye MXN, USD, EUR, GTQ y HNL.
# Sus condiciones piden citar la fuente (lo hace la pantalla de Ajustes).
URL_TASAS = "https://open.er-api.com/v6/latest/USD"
_SEGUNDOS_ENTRE_REINTENTOS = 3600

# Momento del último intento fallido de descarga, para no reintentar (y
# esperar el timeout) en cada petición cuando no hay internet.
_ultimo_fallo: float | None = None


# ---------------------------------------------------------------------------
# Consulta y conversión
# ---------------------------------------------------------------------------
def tasa_por_usd(session: Session, moneda: Moneda, fecha: date) -> Decimal:
    """Unidades de `moneda` por 1 USD en `fecha`.

    Usa la tasa de ese día o la más reciente anterior. Si la fecha es anterior
    a la primera tasa guardada, usa la más antigua que haya.
    """
    if moneda == Moneda.USD:
        return Decimal(1)
    anterior = session.exec(
        select(TasaCambio)
        .where(TasaCambio.moneda == moneda, TasaCambio.fecha <= fecha)
        .order_by(col(TasaCambio.fecha).desc())
    ).first()
    if anterior is not None:
        return anterior.por_usd
    mas_antigua = session.exec(
        select(TasaCambio).where(TasaCambio.moneda == moneda).order_by(col(TasaCambio.fecha))
    ).first()
    if mas_antigua is None:
        raise ReglaDeNegocioError(
            f"No hay tasa de cambio para {moneda.value}. Actualízalas o escríbela en Ajustes."
        )
    return mas_antigua.por_usd


def convertir(session: Session, monto: Decimal, de: Moneda, a: Moneda, fecha: date) -> Decimal:
    """Convierte `monto` de una moneda a otra con las tasas de `fecha`."""
    if de == a:
        return monto
    en_usd = monto / tasa_por_usd(session, de, fecha)
    return (en_usd * tasa_por_usd(session, a, fecha)).quantize(CENTIMOS)


def tasas_vigentes(session: Session) -> list[TasaCambio]:
    """La tasa más reciente de cada moneda (sin USD, que siempre vale 1)."""
    vigentes = []
    for moneda in Moneda:
        if moneda == Moneda.USD:
            continue
        fila = session.exec(
            select(TasaCambio).where(TasaCambio.moneda == moneda).order_by(col(TasaCambio.fecha).desc())
        ).first()
        if fila is not None:
            vigentes.append(fila)
    return vigentes


# ---------------------------------------------------------------------------
# Actualización
# ---------------------------------------------------------------------------
def descargar_tasas() -> dict[Moneda, Decimal]:
    """Pide las tasas actuales a internet. Separada para poder simularla en tests."""
    try:
        with urllib.request.urlopen(URL_TASAS, timeout=5) as respuesta:
            datos = json.load(respuesta)
    except Exception as e:  # sin red, DNS, timeout, JSON inválido…
        raise ServicioExternoError(f"No se pudieron descargar las tasas de cambio: {e}") from e
    if datos.get("result") != "success":
        raise ServicioExternoError("El servicio de tasas de cambio devolvió un error")
    # str() antes de Decimal: Decimal(18.47) arrastraría el error del float.
    return {m: Decimal(str(datos["rates"][m.value])) for m in Moneda if m != Moneda.USD}


def _guardar_tasa(session: Session, moneda: Moneda, por_usd: Decimal, fecha: date, origen: OrigenTasa) -> None:
    existente = session.exec(
        select(TasaCambio).where(TasaCambio.moneda == moneda, TasaCambio.fecha == fecha)
    ).first()
    if existente is None:
        session.add(TasaCambio(moneda=moneda, por_usd=por_usd, fecha=fecha, origen=origen))
    # Una tasa escrita a mano no la pisa la descarga automática.
    elif origen == OrigenTasa.MANUAL or existente.origen == OrigenTasa.API:
        existente.por_usd, existente.origen = por_usd, origen
        session.add(existente)


def actualizar_desde_internet(session: Session, hoy: date | None = None) -> None:
    """Descarga las tasas y las guarda como las de hoy."""
    global _ultimo_fallo
    hoy = hoy or date.today()
    try:
        tasas = descargar_tasas()
    except ServicioExternoError:
        _ultimo_fallo = time.monotonic()
        raise
    for moneda, por_usd in tasas.items():
        _guardar_tasa(session, moneda, por_usd, hoy, OrigenTasa.API)
    session.commit()
    _ultimo_fallo = None


def asegurar_tasas_del_dia(session: Session) -> None:
    """Descarga las tasas si aún no hay de hoy. Nunca lanza error.

    Si no hay internet se seguirán usando las últimas guardadas. Se puede
    desactivar con TASAS_AUTOMATICAS=false (lo hacen los tests).
    """
    if os.getenv("TASAS_AUTOMATICAS", "true").lower() == "false":
        return
    if _ultimo_fallo is not None and time.monotonic() - _ultimo_fallo < _SEGUNDOS_ENTRE_REINTENTOS:
        return
    hay_de_hoy = session.exec(select(TasaCambio.id).where(TasaCambio.fecha == date.today())).first()
    if hay_de_hoy is not None:
        return
    try:
        actualizar_desde_internet(session)
    except ServicioExternoError as e:
        log.warning("%s. Se usarán las últimas tasas guardadas.", e.mensaje)


def fijar_tasa_manual(session: Session, moneda: Moneda, por_usd: Decimal, fecha: date | None = None) -> TasaCambio:
    if moneda == Moneda.USD:
        raise ReglaDeNegocioError("El dólar es la moneda de referencia: su tasa siempre es 1")
    fecha = fecha or date.today()
    _guardar_tasa(session, moneda, por_usd, fecha, OrigenTasa.MANUAL)
    session.commit()
    return session.exec(
        select(TasaCambio).where(TasaCambio.moneda == moneda, TasaCambio.fecha == fecha)
    ).one()


def recalcular_montos_principales(session: Session, principal: Moneda) -> None:
    """Vuelve a convertir todas las transacciones a una nueva moneda principal.

    Usa la tasa histórica de cada transacción. No hace commit: lo hace quien
    llama, junto con el cambio de configuración (todo o nada).
    """
    for transaccion in session.exec(select(Transaccion)).all():
        moneda_original = transaccion.moneda or principal
        transaccion.monto_principal = convertir(
            session, transaccion.monto, moneda_original, principal, transaccion.fecha
        )
        session.add(transaccion)
