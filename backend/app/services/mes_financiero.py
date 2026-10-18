"""El "mes financiero": un mes que empieza el día que elija el usuario.

Si cobras el día 15, tu "octubre" va del 15 de octubre al 14 de noviembre. Un
mes financiero se nombra por el mes en que empieza ("2026-10"). Con día 1, es
el mes natural de siempre.
"""

from datetime import date

from sqlalchemy import Integer, case, cast, func
from sqlalchemy.sql.elements import ColumnElement


def rango_mes(mes_anio: str, dia_inicio: int = 1) -> tuple[date, date]:
    """[primer día, primer día del mes siguiente): el fin no se incluye."""
    anio, mes = map(int, mes_anio.split("-"))
    inicio = date(anio, mes, dia_inicio)
    fin = date(anio + 1, 1, dia_inicio) if mes == 12 else date(anio, mes + 1, dia_inicio)
    return inicio, fin


def mes_de_fecha(fecha: date, dia_inicio: int = 1) -> str:
    """A qué mes financiero pertenece una fecha."""
    if fecha.day >= dia_inicio:
        return f"{fecha.year:04d}-{fecha.month:02d}"
    # Antes del día de inicio: todavía es el mes financiero anterior.
    anio, mes = (fecha.year - 1, 12) if fecha.month == 1 else (fecha.year, fecha.month - 1)
    return f"{anio:04d}-{mes:02d}"


def mes_actual(dia_inicio: int = 1, hoy: date | None = None) -> str:
    return mes_de_fecha(hoy or date.today(), dia_inicio)


def expresion_mes_sql(columna_fecha: ColumnElement, dia_inicio: int) -> ColumnElement:
    """La misma regla que mes_de_fecha, pero en SQL (SQLite) para usarla en un GROUP BY."""
    natural = func.strftime("%Y-%m", columna_fecha)
    if dia_inicio == 1:
        return natural
    anterior = func.strftime("%Y-%m", columna_fecha, "start of month", "-1 month")
    dia = cast(func.strftime("%d", columna_fecha), Integer)
    return case((dia >= dia_inicio, natural), else_=anterior)
