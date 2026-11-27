"""Cálculo de fechas de los cobros periódicos (suscripciones e ingresos recurrentes)."""

import calendar
from dataclasses import dataclass
from datetime import date, timedelta

from app.models import CalendarioFijo, Periodicidad
from app.services.errores import ConflictoError, ReglaDeNegocioError

DIA_QUINCENA = 15
# Un día 31 significa "el último del mes": se recorta al 30, 28 o 29 según el mes.
ULTIMO_DIA = 31
_SABADO = 5
# Ajustes del calendario que admiten un null explícito en un PATCH (vuelven al clásico).
CAMPOS_CALENDARIO = frozenset(
    {"intervalo", "dia_quincena_1", "dia_quincena_2", "dia_del_mes", "dias_de_cobro", "adelantar_a_habil"}
)


@dataclass(frozen=True)
class Calendario:
    """Ajustes opcionales del calendario; los valores por defecto son los de siempre."""

    intervalo: int = 1  # cada cuántos días, semanas, meses o años (no aplica a quincenal)
    dias_quincena: tuple[int, int] = (DIA_QUINCENA, ULTIMO_DIA)
    # Día fijo de los cobros mensuales; None = el de la fecha actual.
    dia_del_mes: int | None = None
    # Días de "varias al mes" (31 = el último); vacío = el día de la fecha actual.
    dias_de_cobro: tuple[int, ...] = ()
    # Si cae en sábado o domingo, se adelanta al viernes (como las nóminas).
    adelantar_a_habil: bool = False


def _ultimo_dia(anio: int, mes: int) -> int:
    return calendar.monthrange(anio, mes)[1]


def _en_mes(anio: int, mes: int, dia: int) -> date:
    """El día `dia` del mes, recortado si el mes es más corto."""
    return date(anio, mes, min(dia, _ultimo_dia(anio, mes)))


def proxima_fecha_del_dia(dia: int, desde: date) -> date:
    """Próxima fecha (`desde` incluida) en que cae el día `dia` del mes, recortado si el mes es corto."""
    este_mes = _en_mes(desde.year, desde.month, dia)
    return este_mes if este_mes >= desde else _sumar_meses(desde.replace(day=1), 1, dia)


def _sumar_meses(fecha: date, meses: int, dia: int | None = None) -> date:
    """Suma meses respetando los meses cortos: 31 ene + 1 mes = 28/29 feb."""
    total = fecha.month - 1 + meses
    return _en_mes(fecha.year + total // 12, total % 12 + 1, dia or fecha.day)


def _siguiente_de_los_dias(fecha: date, dias: tuple[int, ...]) -> date:
    """La siguiente de las fechas de cobro del mes: la quincenal (15 y último) o "varias al mes".

    Desde cualquier día se salta a la siguiente de esas fechas, así un cobro creado
    un día 10 se recoloca solo en el calendario. Los días que en un mes corto caen en
    la misma fecha (30 y 31 en febrero) cuentan una sola vez: no hay cobro doble.
    """
    for dia in sorted(dias):
        candidata = _en_mes(fecha.year, fecha.month, dia)
        if candidata > fecha:
            return candidata
    return _sumar_meses(fecha, 1, min(dias))


def _a_dia_habil(fecha: date) -> date:
    """Sábado y domingo pasan al viernes anterior."""
    return fecha - timedelta(days=max(0, fecha.weekday() - _SABADO + 1))


def _siguiente_nominal(fecha: date, periodicidad: Periodicidad, ajustes: Calendario) -> date:
    n = ajustes.intervalo
    if periodicidad == Periodicidad.DIARIA:
        return fecha + timedelta(days=n)
    if periodicidad == Periodicidad.SEMANAL:
        return fecha + timedelta(weeks=n)
    if periodicidad == Periodicidad.QUINCENAL:
        return _siguiente_de_los_dias(fecha, ajustes.dias_quincena)
    if periodicidad == Periodicidad.VARIAS_AL_MES:
        return _siguiente_de_los_dias(fecha, ajustes.dias_de_cobro or (fecha.day,))
    if periodicidad == Periodicidad.MENSUAL:
        return _sumar_meses(fecha, n, ajustes.dia_del_mes)
    return _sumar_meses(fecha, 12 * n)


def comprobar_fecha_prevista(prevista: date | None, actual: date, que: str) -> None:
    """Rechaza repetir un pago o cobro: si la fecha que se ve en pantalla ya no es la próxima,
    ese periodo ya se anotó (doble clic, otra pestaña, un reintento)."""
    if prevista is not None and prevista != actual:
        raise ConflictoError(f"Ese {que} ya se había registrado: el siguiente es el {actual.strftime('%d/%m/%Y')}")


def siguiente_fecha(fecha: date, periodicidad: Periodicidad, ajustes: Calendario = Calendario()) -> date:
    """Calcula la fecha del próximo cobro a partir de la actual.

    Con `adelantar_a_habil` la fecha guardada puede ser un viernes adelantado: se
    sigue avanzando por las fechas "teóricas" hasta dar con una posterior, para no
    repetir el mismo cobro (el último día cae en domingo → viernes → otra vez domingo).
    Con "varias al mes", dos días seguidos en fin de semana (sábado 29 y domingo 30) caen
    en el mismo viernes y cuentan como un solo cobro: una fecha no puede estar pendiente dos veces.
    """
    candidata = fecha
    while True:
        candidata = _siguiente_nominal(candidata, periodicidad, ajustes)
        resultado = _a_dia_habil(candidata) if ajustes.adelantar_a_habil else candidata
        if resultado > fecha:
            return resultado


def fechas_en_rango(
    fecha_proxima: date, periodicidad: Periodicidad, ajustes: Calendario, desde: date, hasta: date
) -> list[date]:
    """Las fechas previstas de un fijo entre `desde` y `hasta` (ambas incluidas).

    Empieza en `fecha_proxima` (la pendiente: las ya cobradas no salen) y avanza con
    `siguiente_fecha`, igual que al registrar cada cobro. Las pendientes anteriores a
    `desde` (atrasadas) quedan fuera del rango. Pensada para prever un mes: p. ej. los
    tres envíos de 5000 MXN del 10, 20 y 30 de noviembre.
    """
    fechas: list[date] = []
    fecha = fecha_proxima
    while fecha <= hasta:
        if fecha >= desde:
            fechas.append(fecha)
        fecha = siguiente_fecha(fecha, periodicidad, ajustes)
    return fechas


def calendario_de(fijo: CalendarioFijo) -> Calendario:
    """El `Calendario` de un ingreso o pago fijo; los campos null toman el valor clásico."""
    return Calendario(
        intervalo=fijo.intervalo or 1,
        dias_quincena=(fijo.dia_quincena_1 or DIA_QUINCENA, fijo.dia_quincena_2 or ULTIMO_DIA),
        dia_del_mes=fijo.dia_del_mes,
        dias_de_cobro=tuple(fijo.dias_de_cobro or ()),
        adelantar_a_habil=bool(fijo.adelantar_a_habil),
    )


def validar_calendario(fijo: CalendarioFijo) -> None:
    """Coherencia entre la periodicidad y sus ajustes (si no, un 400 legible)."""
    dias = (fijo.dia_quincena_1, fijo.dia_quincena_2)
    if dias.count(None) == 1:
        raise ReglaDeNegocioError("Indica los dos días de cobro de la quincena")
    if None not in dias and dias[0] >= dias[1]:
        raise ReglaDeNegocioError("El primer día de la quincena debe ser anterior al segundo")
    if fijo.periodicidad == Periodicidad.VARIAS_AL_MES and not fijo.dias_de_cobro:
        raise ReglaDeNegocioError("Elige al menos un día del mes para «Varias veces al mes»")
