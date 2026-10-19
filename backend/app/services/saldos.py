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


def movimientos_por_cuenta(
    session: Session, cuenta_id: int | None = None, antes_de: date | None = None
) -> dict[int, Decimal]:
    """Cuánto ha cambiado el saldo de cada cuenta desde su balance inicial.

    Con `antes_de`, solo cuenta los movimientos anteriores a esa fecha (saldos del pasado).

    Son tres sumas en SQL (transacciones, salidas y llegadas de transferencias)
    en vez de cargar todos los movimientos en memoria.
    """
    # (columna de la cuenta, importe, columna de fecha, signo)
    fuentes = [
        (col(Transaccion.cuenta_id), IMPORTE_CON_SIGNO, col(Transaccion.fecha), 1),
        (col(Transferencia.cuenta_origen_id), col(Transferencia.monto_origen), col(Transferencia.fecha), -1),
        (col(Transferencia.cuenta_destino_id), col(Transferencia.monto_destino), col(Transferencia.fecha), 1),
    ]
    totales: defaultdict[int, Decimal] = defaultdict(Decimal)
    for cuenta, importe, fecha, signo in fuentes:
        for id_, suma in _sumas_por_cuenta(session, cuenta, importe, fecha, cuenta_id, antes_de):
            totales[id_] += signo * a_decimal(suma)
    return totales


def saldo_actual(session: Session, cuenta: Cuenta) -> Decimal:
    """Saldo de una cuenta en su moneda."""
    movimiento = movimientos_por_cuenta(session, cuenta.id).get(cuenta.id, Decimal(0))
    return a_decimal(cuenta.balance_inicial + movimiento)
