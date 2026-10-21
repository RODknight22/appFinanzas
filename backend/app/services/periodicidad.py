"""Cálculo de fechas de los cobros periódicos (suscripciones e ingresos recurrentes)."""

import calendar
from dataclasses import dataclass
from datetime import date, timedelta

from app.models import Periodicidad

DIA_QUINCENA = 15
# Un día 31 significa "el último del mes": se recorta al 30, 28 o 29 según el mes.
ULTIMO_DIA = 31
_SABADO = 5


@dataclass(frozen=True)
class Calendario:
    """Ajustes opcionales del calendario; los valores por defecto son los de siempre."""

    intervalo: int = 1  # cada cuántos días, semanas, meses o años (no aplica a quincenal)
    dias_quincena: tuple[int, int] = (DIA_QUINCENA, ULTIMO_DIA)
    # Día fijo de los cobros mensuales; None = el de la fecha actual.
    dia_del_mes: int | None = None
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


def _siguiente_quincena(fecha: date, dias: tuple[int, int]) -> date:
    """La siguiente de las dos fechas de cobro del mes (por defecto, el 15 y el último).

    Desde cualquier día se salta a la siguiente de esas dos fechas, así un
    cobro creado un día 10 se recoloca solo en el calendario de quincenas.
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
        return _siguiente_quincena(fecha, ajustes.dias_quincena)
    if periodicidad == Periodicidad.MENSUAL:
        return _sumar_meses(fecha, n, ajustes.dia_del_mes)
    return _sumar_meses(fecha, 12 * n)


def siguiente_fecha(fecha: date, periodicidad: Periodicidad, ajustes: Calendario = Calendario()) -> date:
    """Calcula la fecha del próximo cobro a partir de la actual.

    Con `adelantar_a_habil` la fecha guardada puede ser un viernes adelantado: se
    sigue avanzando por las fechas "teóricas" hasta dar con una posterior, para no
    repetir el mismo cobro (el último día cae en domingo → viernes → otra vez domingo).
    """
    candidata = fecha
    while True:
        candidata = _siguiente_nominal(candidata, periodicidad, ajustes)
        resultado = _a_dia_habil(candidata) if ajustes.adelantar_a_habil else candidata
        if resultado > fecha:
            return resultado
