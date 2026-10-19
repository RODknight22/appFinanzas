"""Cálculo de saldos, compartido por el dashboard y las cuentas.

saldo = balance inicial + ingresos − gastos − transferencias que salen + transferencias que llegan
"""

from collections import defaultdict
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


def _sumas_por_cuenta(session: Session, cuenta: Any, importe: Any, cuenta_id: int | None) -> list[tuple[int, Any]]:
    """SUM(importe) agrupado por la columna `cuenta` (opcionalmente de una sola cuenta)."""
    consulta = select(cuenta, func.sum(importe)).group_by(cuenta)
    if cuenta_id is not None:
        consulta = consulta.where(cuenta == cuenta_id)
    return list(session.exec(consulta).all())


def movimientos_por_cuenta(session: Session, cuenta_id: int | None = None) -> dict[int, Decimal]:
    """Cuánto ha cambiado el saldo de cada cuenta desde su balance inicial.

    Son tres sumas en SQL (transacciones, salidas y llegadas de transferencias)
    en vez de cargar todos los movimientos en memoria.
    """
    totales: defaultdict[int, Decimal] = defaultdict(Decimal)
    for id_, suma in _sumas_por_cuenta(session, col(Transaccion.cuenta_id), IMPORTE_CON_SIGNO, cuenta_id):
        totales[id_] += a_decimal(suma)
    for id_, suma in _sumas_por_cuenta(session, col(Transferencia.cuenta_origen_id), col(Transferencia.monto_origen), cuenta_id):
        totales[id_] -= a_decimal(suma)
    for id_, suma in _sumas_por_cuenta(session, col(Transferencia.cuenta_destino_id), col(Transferencia.monto_destino), cuenta_id):
        totales[id_] += a_decimal(suma)
    return totales


def saldo_actual(session: Session, cuenta: Cuenta) -> Decimal:
    """Saldo de una cuenta en su moneda."""
    movimiento = movimientos_por_cuenta(session, cuenta.id).get(cuenta.id, Decimal(0))
    return a_decimal(cuenta.balance_inicial + movimiento)
