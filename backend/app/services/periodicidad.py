"""Cálculo de fechas de los cobros periódicos (suscripciones e ingresos recurrentes)."""

import calendar
from datetime import date, timedelta

from app.models import Periodicidad

DIA_QUINCENA = 15


def _ultimo_dia(anio: int, mes: int) -> int:
    return calendar.monthrange(anio, mes)[1]


def _sumar_meses(fecha: date, meses: int) -> date:
    """Suma meses respetando los meses cortos: 31 ene + 1 mes = 28/29 feb."""
    total = fecha.month - 1 + meses
    anio, mes = fecha.year + total // 12, total % 12 + 1
    return date(anio, mes, min(fecha.day, _ultimo_dia(anio, mes)))


def _siguiente_quincena(fecha: date) -> date:
    """Las quincenas caen el 15 y el último día del mes (30, 31, 28 o 29).

    Desde cualquier día se salta a la siguiente de esas dos fechas, así un
    cobro creado un día 10 se recoloca solo en el calendario de quincenas.
    """
    fin_de_mes = _ultimo_dia(fecha.year, fecha.month)
    if fecha.day < DIA_QUINCENA:
        return fecha.replace(day=DIA_QUINCENA)
    if fecha.day < fin_de_mes:
        return fecha.replace(day=fin_de_mes)
    return _sumar_meses(fecha.replace(day=DIA_QUINCENA), 1)


def siguiente_fecha(fecha: date, periodicidad: Periodicidad) -> date:
    """Calcula la fecha del próximo cobro a partir de la actual."""
    if periodicidad == Periodicidad.SEMANAL:
        return fecha + timedelta(weeks=1)
    if periodicidad == Periodicidad.QUINCENAL:
        return _siguiente_quincena(fecha)
    if periodicidad == Periodicidad.MENSUAL:
        return _sumar_meses(fecha, 1)
    return _sumar_meses(fecha, 12)
