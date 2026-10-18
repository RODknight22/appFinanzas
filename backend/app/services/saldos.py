"""Cálculo de saldos, compartido por el dashboard y las cuentas."""

from decimal import Decimal
from typing import Any

from sqlalchemy import case, func
from sqlmodel import Session, col, select

from app.models import Cuenta, TipoMovimiento, Transaccion

CENTIMOS = Decimal("0.01")

# Importe con signo en la moneda de la cuenta: los ingresos suman y los gastos restan.
IMPORTE_CON_SIGNO = case(
    (col(Transaccion.tipo) == TipoMovimiento.GASTO, -col(Transaccion.monto_cuenta)),
    else_=col(Transaccion.monto_cuenta),
)


def a_decimal(valor: Any) -> Decimal:
    """SQLite suma los importes como números flotantes; los devolvemos a Decimal exacto."""
    return Decimal(str(valor or 0)).quantize(CENTIMOS)


def saldo_actual(session: Session, cuenta: Cuenta) -> Decimal:
    """Balance inicial + ingresos - gastos de una cuenta."""
    movimiento = session.exec(
        select(func.sum(IMPORTE_CON_SIGNO)).where(Transaccion.cuenta_id == cuenta.id)
    ).one()
    return a_decimal(cuenta.balance_inicial + a_decimal(movimiento))
