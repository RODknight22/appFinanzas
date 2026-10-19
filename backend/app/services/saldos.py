"""Cálculo de saldos, compartido por el dashboard y las cuentas.

saldo = balance inicial + ingresos − gastos − transferencias que salen + transferencias que llegan
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import case, func
from sqlmodel import Session, col, select

from app.models import Cuenta, TipoMovimiento, Transaccion, Transferencia
from app.services import mes_financiero

CENTIMOS = Decimal("0.01")

# Importe con signo en la moneda de la cuenta: los ingresos suman y los gastos restan.
IMPORTE_CON_SIGNO = case(
    (col(Transaccion.tipo) == TipoMovimiento.GASTO, -col(Transaccion.monto_cuenta)),
    else_=col(Transaccion.monto_cuenta),
)


def a_decimal(valor: Any) -> Decimal:
    """SQLite suma los importes como números flotantes; los devolvemos a Decimal exacto."""
    return Decimal(str(valor or 0)).quantize(CENTIMOS)


def _sumas_por_cuenta(
    session: Session, cuenta: Any, importe: Any, fecha: Any, cuenta_id: int | None, antes_de: date | None
) -> list[tuple[int, Any]]:
    """SUM(importe) agrupado por la columna `cuenta` (opcionalmente de una cuenta o hasta una fecha)."""
    consulta = select(cuenta, func.sum(importe)).group_by(cuenta)
    if cuenta_id is not None:
        consulta = consulta.where(cuenta == cuenta_id)
    if antes_de is not None:
        consulta = consulta.where(fecha < antes_de)
    return list(session.exec(consulta).all())


# (columna de la cuenta, importe, columna de fecha, signo)
_FUENTES = [
    (col(Transaccion.cuenta_id), IMPORTE_CON_SIGNO, col(Transaccion.fecha), 1),
    (col(Transferencia.cuenta_origen_id), col(Transferencia.monto_origen), col(Transferencia.fecha), -1),
    (col(Transferencia.cuenta_destino_id), col(Transferencia.monto_destino), col(Transferencia.fecha), 1),
]


def movimientos_por_cuenta(
    session: Session, cuenta_id: int | None = None, antes_de: date | None = None
) -> dict[int, Decimal]:
    """Cuánto ha cambiado el saldo de cada cuenta desde su balance inicial.

    Con `antes_de`, solo cuenta los movimientos anteriores a esa fecha (saldos del pasado).

    Son tres sumas en SQL (transacciones, salidas y llegadas de transferencias)
    en vez de cargar todos los movimientos en memoria.
    """
    totales: defaultdict[int, Decimal] = defaultdict(Decimal)
    for cuenta, importe, fecha, signo in _FUENTES:
        for id_, suma in _sumas_por_cuenta(session, cuenta, importe, fecha, cuenta_id, antes_de):
            totales[id_] += signo * a_decimal(suma)
    return totales


def movimientos_por_cuenta_y_mes(
    session: Session, dia_inicio: int, desde: date, hasta: date
) -> dict[tuple[int, str], Decimal]:
    """Como `movimientos_por_cuenta`, pero desglosado por (cuenta, mes financiero "YYYY-MM").

    Solo cuenta los movimientos de [desde, hasta). Con tres sumas en total sirve para
    reconstruir el saldo de muchos meses, en vez de repetir las tres por cada mes.
    """
    totales: defaultdict[tuple[int, str], Decimal] = defaultdict(Decimal)
    for cuenta, importe, fecha, signo in _FUENTES:
        mes = mes_financiero.expresion_mes_sql(fecha, dia_inicio)
        consulta = (
            select(cuenta, mes, func.sum(importe))
            .where(fecha >= desde, fecha < hasta)
            .group_by(cuenta, mes)
        )
        for id_, mes_anio, suma in session.exec(consulta).all():
            totales[(id_, mes_anio)] += signo * a_decimal(suma)
    return totales


def saldo_actual(session: Session, cuenta: Cuenta) -> Decimal:
    """Saldo de una cuenta en su moneda."""
    movimiento = movimientos_por_cuenta(session, cuenta.id).get(cuenta.id, Decimal(0))
    return a_decimal(cuenta.balance_inicial + movimiento)
