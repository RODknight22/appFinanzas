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
import math
import os
import threading
import time
import urllib.request
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased
from sqlmodel import Session, col, select

from app.models import (
    Configuracion,
    Cuenta,
    LadoTransferencia,
    Moneda,
    OrigenTasa,
    TasaCambio,
    Transaccion,
    Transferencia,
)
from app.schemas import TasaRead
from app.services.errores import ReglaDeNegocioError, ServicioExternoError
from app.services.saldos import CENTIMOS
from app.version import VERSION

log = logging.getLogger(__name__)

# Servicio gratuito sin clave que incluye todas las monedas de la app (y muchas más).
# Sus condiciones piden citar la fuente (lo hace la pantalla de Ajustes).
URL_TASAS = "https://open.er-api.com/v6/latest/USD"
_SEGUNDOS_ENTRE_REINTENTOS = 3600

# Tasas de días pasados: las del Banco Central Europeo (vía Frankfurter, gratis y sin
# clave), que publica cada día laborable desde 1999. No incluye GTQ, HNL, COP, ARS, CLP ni
# PEN: para esas se sigue usando la tasa guardada más cercana.
URL_HISTORICAS = "https://api.frankfurter.dev/v1/{desde}..{hasta}?base=USD&symbols={monedas}"
MONEDAS_HISTORICAS = (Moneda.EUR, Moneda.MXN)
PRIMER_DIA_HISTORICO = date(1999, 1, 4)
# Fines de semana y festivos no tienen tasa: hasta 6 días sin ella no es un hueco.
_HUECO_MAXIMO = timedelta(days=6)
_TIMEOUT_HISTORICAS = 10
_ultimo_fallo_historicas: float | None = None

# Momento del último intento fallido de descarga, para no reintentar (y
# esperar el timeout) en cada petición cuando no hay internet.
_ultimo_fallo: float | None = None

# Varias peticiones simultáneas (hilos) pueden ver "no hay tasas de hoy" a la vez,
# sobre todo tras medianoche: el candado hace que solo una descargue.
_candado_descarga = threading.Lock()

_TIMEOUT_DESCARGA = 3
_MAX_BYTES_RESPUESTA = 1_000_000
# Rango sensato para una tasa por USD: protege de datos corruptos o absurdos.
_TASA_MINIMA = Decimal("0.000001")
_TASA_MAXIMA = Decimal(1_000_000)
_SEIS_DECIMALES = Decimal("0.000001")


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
    # Caché en la sesión: una petición convierte cientos de veces con las mismas
    # tasas. La sesión vive solo durante una petición, así que no hace falta más
    # invalidación que la de las funciones que escriben tasas (_guardar_tasa).
    cache: dict[tuple[Moneda, date], Decimal] = session.info.setdefault("tasas_por_usd", {})
    if (moneda, fecha) in cache:
        return cache[(moneda, fecha)]
    por_usd = _buscar_tasa_por_usd(session, moneda, fecha)
    cache[(moneda, fecha)] = por_usd
    return por_usd


def _buscar_tasa_por_usd(session: Session, moneda: Moneda, fecha: date) -> Decimal:
    # .limit(1) en todas estas búsquedas: .first() no lo añade a la consulta, y sin él
    # SQLite devuelve (y SQLAlchemy construye) todas las tasas de años para usar una.
    anterior = session.exec(
        select(TasaCambio)
        .where(TasaCambio.moneda == moneda, TasaCambio.fecha <= fecha)
        .order_by(col(TasaCambio.fecha).desc())
        .limit(1)
    ).first()
    if anterior is not None:
        return anterior.por_usd
    mas_antigua = session.exec(
        select(TasaCambio).where(TasaCambio.moneda == moneda).order_by(col(TasaCambio.fecha)).limit(1)
    ).first()
    if mas_antigua is None:
        raise ReglaDeNegocioError(
            f"No hay tasa de cambio para {moneda.value}. Actualízalas o escríbela en Ajustes."
        )
    return mas_antigua.por_usd


def convertir_sin_redondeo(session: Session, monto: Decimal, de: Moneda, a: Moneda, fecha: date) -> Decimal:
    if de == a:
        return monto
    return monto / tasa_por_usd(session, de, fecha) * tasa_por_usd(session, a, fecha)


def convertir(session: Session, monto: Decimal, de: Moneda, a: Moneda, fecha: date) -> Decimal:
    """Convierte `monto` de una moneda a otra con las tasas de `fecha` (redondeado a céntimos)."""
    return convertir_sin_redondeo(session, monto, de, a, fecha).quantize(CENTIMOS)


def _ultima_tasa(session: Session, moneda: Moneda) -> TasaCambio | None:
    return session.exec(
        select(TasaCambio).where(TasaCambio.moneda == moneda).order_by(col(TasaCambio.fecha).desc()).limit(1)
    ).first()


def tasas_vigentes(session: Session, principal: Moneda) -> list[TasaRead]:
    """Cuánto vale hoy 1 unidad de cada moneda en la principal (1 EUR = 20.76 MXN).

    Internamente todo se guarda respecto al USD; aquí se traduce a la moneda
    principal, que es como lo piensa el usuario. La principal no aparece (vale 1).
    """
    hoy = date.today()
    vigentes: list[TasaRead] = []
    for moneda in Moneda:
        if moneda == principal:
            continue
        # La fila que "manda" en esta tasa: la de la moneda, o la de la principal
        # cuando la moneda es el USD (que no tiene fila propia).
        fila = _ultima_tasa(session, principal if moneda == Moneda.USD else moneda)
        if fila is None:
            continue
        try:
            en_principal = convertir_sin_redondeo(session, Decimal(1), moneda, principal, hoy)
        except ReglaDeNegocioError:
            continue  # falta la tasa de esta moneda o de la principal: no se puede convertir
        vigentes.append(
            TasaRead(
                moneda=moneda,
                en_principal=en_principal.quantize(Decimal("0.000001")),
                fecha=fila.fecha,
                origen=fila.origen,
            )
        )
    return vigentes


# ---------------------------------------------------------------------------
# Actualización
# ---------------------------------------------------------------------------
def _pedir_json() -> object:
    """Descarga y decodifica la respuesta (máx. 1 MB). Separada para simularla en tests."""
    with urllib.request.urlopen(URL_TASAS, timeout=_TIMEOUT_DESCARGA) as respuesta:
        return json.loads(respuesta.read(_MAX_BYTES_RESPUESTA))


def _validar_tasas(datos: object) -> dict[Moneda, Decimal]:
    """Extrae las tasas de la respuesta; lanza ValueError si algo no cuadra.

    Si falta una moneda, se guardan las demás (y esa sigue con su última tasa): que el
    servicio deje de publicar una no debe dejar a todas sin actualizar.
    """
    if not isinstance(datos, dict) or datos.get("result") != "success":
        raise ValueError("respuesta inesperada del servicio de tasas")
    rates = datos.get("rates")
    if not isinstance(rates, dict):
        raise ValueError("la respuesta no incluye 'rates'")
    tasas: dict[Moneda, Decimal] = {}
    for moneda in Moneda:
        if moneda == Moneda.USD:
            continue
        if moneda.value not in rates:
            log.warning("El servicio de tasas no trae %s: se mantiene la última guardada", moneda.value)
            continue
        valor = rates[moneda.value]
        # bool es subclase de int: se descarta a mano.
        if isinstance(valor, bool) or not isinstance(valor, (int, float)) or not math.isfinite(valor):
            raise ValueError(f"tasa no numérica para {moneda.value}")
        # str() antes de Decimal: Decimal(18.47) arrastraría el error del float.
        tasa = Decimal(str(valor))
        if not _TASA_MINIMA <= tasa <= _TASA_MAXIMA:
            raise ValueError(f"tasa fuera de rango para {moneda.value}")
        tasas[moneda] = tasa
    if not tasas:
        raise ValueError("la respuesta no trae ninguna moneda de la app")
    return tasas


def descargar_tasas() -> dict[Moneda, Decimal]:
    """Pide las tasas actuales a internet. Cualquier fallo se convierte en ServicioExternoError."""
    try:
        return _validar_tasas(_pedir_json())
    except Exception as e:  # sin red, timeout, JSON inválido, datos absurdos…
        # El detalle técnico solo va al log: al cliente le llega un mensaje genérico.
        log.warning("Fallo al descargar las tasas de cambio", exc_info=e)
        raise ServicioExternoError("No se pudieron descargar las tasas de cambio") from e


def _guardar_tasa(session: Session, moneda: Moneda, por_usd: Decimal, fecha: date, origen: OrigenTasa) -> None:
    session.info.pop("tasas_por_usd", None)  # las tasas cambian: la caché ya no vale
    existente = _tasa_del_dia(session, moneda, fecha)
    if existente is None:
        try:
            # Savepoint: si otra petición insertó la misma (fecha, moneda) a la vez,
            # solo se deshace este insert y se actualiza la fila existente.
            with session.begin_nested():
                session.add(TasaCambio(moneda=moneda, por_usd=por_usd, fecha=fecha, origen=origen))
            return
        except IntegrityError:
            existente = _tasa_del_dia(session, moneda, fecha)
            if existente is None:
                raise
    # Una tasa escrita a mano no la pisa la descarga automática.
    if origen == OrigenTasa.MANUAL or existente.origen == OrigenTasa.API:
        existente.por_usd, existente.origen = por_usd, origen
        session.add(existente)


def _tasa_del_dia(session: Session, moneda: Moneda, fecha: date) -> TasaCambio | None:
    return session.exec(
        select(TasaCambio).where(TasaCambio.moneda == moneda, TasaCambio.fecha == fecha)
    ).first()


def _tiene_cambios_propios(session: Session) -> bool:
    """¿Lleva la sesión cambios sin confirmar de quien la usa (p. ej. una importación a medias)?"""
    if session.new or session.dirty or session.deleted:
        return True
    # Cambios ya enviados a SQLite (flush) pero sin commit: los delata la transacción abierta.
    conexion = session.connection().connection.dbapi_connection
    return bool(getattr(conexion, "in_transaction", False))


def actualizar_desde_internet(session: Session, hoy: date | None = None) -> None:
    """Descarga las tasas y las guarda como las de hoy.

    Si quien llama ya tiene cambios a medio hacer, no se hace commit: confirmaría también
    esos cambios aunque luego su operación falle (una importación rechazada dejaría
    borrado el movimiento que iba a unir). Las tasas se confirman o se deshacen con ellos.
    """
    global _ultimo_fallo
    hoy = hoy or date.today()
    con_cambios = _tiene_cambios_propios(session)
    try:
        tasas = descargar_tasas()
    except ServicioExternoError:
        _ultimo_fallo = time.monotonic()
        raise
    for moneda, por_usd in tasas.items():
        _guardar_tasa(session, moneda, por_usd, hoy, OrigenTasa.API)
    if con_cambios:
        session.flush()
    else:
        session.commit()
    _ultimo_fallo = None


def asegurar_tasas_del_dia(session: Session) -> None:
    """Descarga las tasas si aún no hay de hoy. Nunca lanza error.

    Si no hay internet se seguirán usando las últimas guardadas. Se puede
    desactivar con TASAS_AUTOMATICAS=false (lo hacen los tests).
    """
    if os.getenv("TASAS_AUTOMATICAS", "true").lower() == "false":
        return
    if _en_espera_tras_fallo() or _hay_tasas_de_hoy(session):
        return
    with _candado_descarga:
        # Doble comprobación: mientras esperábamos el candado otra petición pudo
        # descargar (hay tasas) o fallar (se activó la espera).
        if _en_espera_tras_fallo() or _hay_tasas_de_hoy(session):
            return
        try:
            actualizar_desde_internet(session)
        except ServicioExternoError as e:
            log.warning("%s. Se usarán las últimas tasas guardadas.", e.mensaje)


def _en_espera_tras_fallo() -> bool:
    return _ultimo_fallo is not None and time.monotonic() - _ultimo_fallo < _SEGUNDOS_ENTRE_REINTENTOS


def _hay_tasas_de_hoy(session: Session) -> bool:
    # Se consulta de nuevo en cada llamada: la sesión puede ver tasas recién guardadas por otra.
    return session.exec(select(TasaCambio.id).where(TasaCambio.fecha == date.today())).first() is not None


def fijar_tasa_manual(session: Session, moneda: Moneda, por_usd: Decimal, fecha: date | None = None) -> None:
    """Guarda a mano la tasa interna (unidades de `moneda` por 1 USD)."""
    if moneda == Moneda.USD:
        raise ReglaDeNegocioError("El dólar es la moneda de referencia interna: su tasa siempre es 1")
    por_usd = por_usd.quantize(_SEIS_DECIMALES)
    if not _TASA_MINIMA <= por_usd <= _TASA_MAXIMA:  # tras invertir/redondear puede quedar en 0
        raise ReglaDeNegocioError("La tasa está fuera de rango")
    _guardar_tasa(session, moneda, por_usd, fecha or date.today(), OrigenTasa.MANUAL)
    session.commit()


def fijar_tasa_en_principal(session: Session, moneda: Moneda, en_principal: Decimal, principal: Moneda) -> None:
    """El usuario escribe "1 `moneda` = `en_principal` en mi moneda principal".

    Lo traducimos a la tasa interna respecto al USD:
    - moneda = USD: 1 USD = N principal → es justo la tasa de la principal.
    - principal = USD: 1 X = N USD → tasa de X = 1 / N.
    - resto: 1 X = N principal → tasa de X = tasa(principal) / N.
    """
    if moneda == principal:
        raise ReglaDeNegocioError("La moneda principal siempre vale 1 en sí misma")
    if en_principal <= 0:  # evita dividir entre cero al invertir
        raise ReglaDeNegocioError("La tasa está fuera de rango")
    if moneda == Moneda.USD:
        fijar_tasa_manual(session, principal, en_principal)
    elif principal == Moneda.USD:
        fijar_tasa_manual(session, moneda, Decimal(1) / en_principal)
    else:
        fijar_tasa_manual(session, moneda, tasa_por_usd(session, principal, date.today()) / en_principal)


def recalcular_montos_principales(session: Session, principal: Moneda) -> None:
    """Vuelve a convertir todas las transacciones a una nueva moneda principal.

    Usa la tasa histórica de cada transacción. No hace commit: lo hace quien
    llama, junto con el cambio de configuración (todo o nada).
    """
    filas = session.exec(
        select(Transaccion.id, Transaccion.monto, Transaccion.moneda, Transaccion.fecha)
    ).all()
    nuevos = [
        {"id": id_, "monto_principal": convertir(session, monto, moneda or principal, principal, fecha)}
        for id_, monto, moneda, fecha in filas
    ]
    if nuevos:
        # Un solo UPDATE por clave primaria en lote, sin cargar objetos ORM.
        session.execute(update(Transaccion), nuevos)


# ---------------------------------------------------------------------------
# Tasas históricas (días pasados)
# ---------------------------------------------------------------------------
def _pedir_json_historico(url: str) -> object:
    """Como _pedir_json, para el rango de fechas. Separada para simularla en tests.

    Con nombre propio: el servicio rechaza (403) el "Python-urllib" que se envía por defecto.
    """
    peticion = urllib.request.Request(url, headers={"User-Agent": f"appFinanzas/{VERSION}"})
    with urllib.request.urlopen(peticion, timeout=_TIMEOUT_HISTORICAS) as respuesta:
        return json.loads(respuesta.read(_MAX_BYTES_RESPUESTA))


def _validar_historicas(datos: object) -> dict[date, dict[Moneda, Decimal]]:
    """{"rates": {"2026-10-01": {"EUR": 0.88, "MXN": 18.1}, ...}} → tasas por día. ValueError si no cuadra."""
    rates = datos.get("rates") if isinstance(datos, dict) else None
    if not isinstance(rates, dict):
        raise ValueError("la respuesta no incluye 'rates'")
    por_dia: dict[date, dict[Moneda, Decimal]] = {}
    for dia, valores in rates.items():
        fecha = date.fromisoformat(dia)
        if not isinstance(valores, dict):
            raise ValueError(f"tasas no válidas para {dia}")
        por_dia[fecha] = {}
        for moneda in MONEDAS_HISTORICAS:
            valor = valores.get(moneda.value)
            if isinstance(valor, bool) or not isinstance(valor, (int, float)) or not math.isfinite(valor):
                raise ValueError(f"tasa no numérica para {moneda.value} el {dia}")
            tasa = Decimal(str(valor))
            if not _TASA_MINIMA <= tasa <= _TASA_MAXIMA:
                raise ValueError(f"tasa fuera de rango para {moneda.value} el {dia}")
            por_dia[fecha][moneda] = tasa
    return por_dia


def _hay_huecos(session: Session, moneda: Moneda, desde: date, hasta: date) -> bool:
    """¿Algún día del periodo no tiene una tasa de esa moneda en los 6 días anteriores?"""
    fechas = session.exec(
        select(TasaCambio.fecha)
        .where(TasaCambio.moneda == moneda, TasaCambio.fecha >= desde - _HUECO_MAXIMO, TasaCambio.fecha <= hasta)
        .order_by(col(TasaCambio.fecha))
    ).all()
    cubierto_hasta: date | None = None  # último día que cubre la tasa anterior
    for fecha in fechas:
        if (fecha > desde) if cubierto_hasta is None else (fecha > cubierto_hasta + timedelta(days=1)):
            return True
        cubierto_hasta = fecha + _HUECO_MAXIMO
    return cubierto_hasta is None or cubierto_hasta < hasta


def recalcular_montos_desde(session: Session, desde: date) -> None:
    """Vuelve a convertir las transacciones desde `desde` con las tasas de su fecha.

    Se usa al guardar tasas de días que no las tenían: lo que se anotó entonces se
    convirtió con la tasa más cercana que había, y ahora hay una mejor. También corrige
    el lado estimado de las transferencias (nunca el real). No hace commit.
    """
    _recalcular_transferencias_desde(session, desde)
    configuracion = session.get(Configuracion, 1)
    principal = configuracion.moneda if configuracion else Moneda.MXN
    filas = session.exec(
        select(Transaccion.id, Transaccion.monto, Transaccion.moneda, Transaccion.fecha, Cuenta.moneda)
        .join(Cuenta, col(Transaccion.cuenta_id) == col(Cuenta.id))
        .where(Transaccion.fecha >= desde)
    ).all()
    nuevos = []
    for id_, monto, moneda, fecha, moneda_cuenta in filas:
        moneda_cuenta = moneda_cuenta or principal
        origen = moneda or moneda_cuenta
        nuevos.append({
            "id": id_,
            "monto_cuenta": convertir(session, monto, origen, moneda_cuenta, fecha),
            "monto_principal": convertir(session, monto, origen, principal, fecha),
        })
    if nuevos:
        session.execute(update(Transaccion), nuevos)


def _recalcular_transferencias_desde(session: Session, desde: date) -> None:
    """Vuelve a estimar el lado estimado de las transferencias desde `desde`."""
    origen, destino = aliased(Cuenta), aliased(Cuenta)
    filas = session.exec(
        select(
            Transferencia.id, Transferencia.lado_estimado, Transferencia.monto_origen,
            Transferencia.monto_destino, Transferencia.fecha, origen.moneda, destino.moneda,
        )
        .join(origen, col(Transferencia.cuenta_origen_id) == col(origen.id))
        .join(destino, col(Transferencia.cuenta_destino_id) == col(destino.id))
        .where(Transferencia.fecha >= desde, col(Transferencia.lado_estimado).is_not(None))
    ).all()
    nuevos = []
    for id_, lado, monto_origen, monto_destino, fecha, moneda_origen, moneda_destino in filas:
        if lado == LadoTransferencia.DESTINO:
            nuevos.append({"id": id_, "monto_destino": convertir(session, monto_origen, moneda_origen, moneda_destino, fecha)})
        elif monto_destino is not None:
            nuevos.append({"id": id_, "monto_origen": convertir(session, monto_destino, moneda_destino, moneda_origen, fecha)})
    for fila in nuevos:  # un lado u otro: no todas las filas cambian la misma columna
        session.execute(update(Transferencia).where(col(Transferencia.id) == fila.pop("id")).values(**fila))


def asegurar_tasas_historicas(session: Session, desde: date, hasta: date | None = None) -> None:
    """Descarga las tasas de los días del periodo que no las tengan. Nunca lanza error.

    Solo pide internet si hay huecos (una consulta por moneda si no los hay). No pisa
    ninguna tasa existente, y menos una manual. Si guarda alguna, recalcula las
    transacciones afectadas. Sin internet, todo sigue con la tasa más cercana.

    No hace commit: las tasas se guardan junto con la operación que las necesitó,
    y si esta falla se deshace todo (se volverán a descargar la próxima vez).
    """
    global _ultimo_fallo_historicas
    if os.getenv("TASAS_AUTOMATICAS", "true").lower() == "false":
        return
    hoy = date.today()
    desde, hasta = max(desde, PRIMER_DIA_HISTORICO), min(hasta or hoy, hoy)
    if desde > hasta or not any(_hay_huecos(session, m, desde, hasta) for m in MONEDAS_HISTORICAS):
        return
    if _ultimo_fallo_historicas is not None and time.monotonic() - _ultimo_fallo_historicas < _SEGUNDOS_ENTRE_REINTENTOS:
        return
    # Se pide desde unos días antes: así el primer día del periodo, si cae en
    # fin de semana, también tiene la tasa del viernes anterior.
    url = URL_HISTORICAS.format(
        desde=(desde - _HUECO_MAXIMO).isoformat(), hasta=hasta.isoformat(),
        monedas=",".join(m.value for m in MONEDAS_HISTORICAS),
    )
    try:
        por_dia = _validar_historicas(_pedir_json_historico(url))
    except Exception as e:  # sin red, timeout, respuesta rara…
        _ultimo_fallo_historicas = time.monotonic()
        log.warning("Fallo al descargar tasas históricas; se usará la tasa más cercana", exc_info=e)
        return
    _ultimo_fallo_historicas = None

    existentes = set(session.exec(
        select(TasaCambio.fecha, TasaCambio.moneda).where(TasaCambio.fecha.in_(list(por_dia)))  # type: ignore[attr-defined]
    ).all())
    nuevas = [
        TasaCambio(moneda=moneda, por_usd=tasa, fecha=fecha, origen=OrigenTasa.API)
        for fecha, tasas in por_dia.items() for moneda, tasa in tasas.items()
        if (fecha, moneda) not in existentes
    ]
    if not nuevas:
        return
    session.add_all(nuevas)
    session.flush()
    session.info.pop("tasas_por_usd", None)  # hay tasas nuevas: la caché ya no vale
    recalcular_montos_desde(session, min(t.fecha for t in nuevas))
