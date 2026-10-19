"""Cálculos del dashboard: balances, flujo mensual, gastos por categoría y presupuestos.

Las sumas se hacen en SQL (GROUP BY) para no cargar todas las transacciones en memoria,
siempre sobre `monto_principal`: así se suman importes de distintas monedas.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.models import Categoria, Cuenta, Presupuesto, TipoMovimiento, Transaccion
from app.schemas import (
    FlujoMensual,
    GastoPorCategoria,
    ProgresoPresupuesto,
    ResumenMes,
    SaldoCuenta,
)
from app.services import configuracion, divisas, mes_financiero
from app.services.saldos import a_decimal, movimientos_por_cuenta


# ---------------------------------------------------------------------------
# Utilidades de fechas y dinero
# ---------------------------------------------------------------------------
def mes_actual(session: Session) -> str:
    """El mes financiero en curso (depende del día de inicio de mes elegido)."""
    return mes_financiero.mes_actual(configuracion.dia_inicio_mes(session))


def _rango_mes(session: Session, mes_anio: str) -> tuple[date, date]:
    """[inicio, fin) del mes financiero `mes_anio` según la configuración."""
    return mes_financiero.rango_mes(mes_anio, configuracion.dia_inicio_mes(session))


def _meses_anteriores(hasta_mes: str, cantidad: int) -> list[str]:
    """Lista de `cantidad` meses terminando en `hasta_mes`, del más antiguo al más nuevo."""
    anio, mes = map(int, hasta_mes.split("-"))
    meses: list[str] = []
    for _ in range(cantidad):
        meses.append(f"{anio:04d}-{mes:02d}")
        anio, mes = (anio - 1, 12) if mes == 1 else (anio, mes - 1)
    return list(reversed(meses))


def _porcentaje(parte: Decimal, total: Decimal) -> float:
    return round(float(parte / total * 100), 1) if total else 0.0


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------
def _saldos_por_cuenta(session: Session) -> list[SaldoCuenta]:
    """Saldo de cada cuenta en su moneda y convertido a la principal.

    Para un saldo (dinero que tienes hoy) se usa la tasa de hoy, no la histórica.
    """
    principal = configuracion.moneda_principal(session)
    hoy = date.today()
    cuentas = session.exec(select(Cuenta).order_by(col(Cuenta.nombre))).all()
    movimientos = movimientos_por_cuenta(session)
    if any(cuenta.moneda != principal for cuenta in cuentas):
        divisas.asegurar_tasas_del_dia(session)

    saldos = []
    for cuenta in cuentas:
        moneda = cuenta.moneda or principal
        # .get(): una cuenta sin movimientos no aparece en el diccionario.
        saldo = a_decimal(cuenta.balance_inicial + movimientos.get(cuenta.id, Decimal(0)))
        saldos.append(
            SaldoCuenta(
                cuenta_id=cuenta.id,
                nombre=cuenta.nombre,
                tipo=cuenta.tipo,
                moneda=moneda,
                saldo=saldo,
                saldo_principal=divisas.convertir(session, saldo, moneda, principal, hoy),
            )
        )
    return saldos


def _totales_por_tipo(session: Session, inicio: date, fin: date) -> dict[TipoMovimiento, Decimal]:
    consulta = (
        select(Transaccion.tipo, func.sum(Transaccion.monto_principal))
        .where(Transaccion.fecha >= inicio, Transaccion.fecha < fin)
        .group_by(col(Transaccion.tipo))
    )
    totales = {tipo: Decimal("0.00") for tipo in TipoMovimiento}
    for tipo, suma in session.exec(consulta).all():
        totales[tipo] = a_decimal(suma)
    return totales


def _gastos_por_categoria_id(session: Session, mes_anio: str) -> dict[int, Decimal]:
    inicio, fin = _rango_mes(session, mes_anio)
    consulta = (
        select(Transaccion.categoria_id, func.sum(Transaccion.monto_principal))
        .where(
            Transaccion.tipo == TipoMovimiento.GASTO,
            Transaccion.fecha >= inicio,
            Transaccion.fecha < fin,
        )
        .group_by(col(Transaccion.categoria_id))
    )
    return {categoria_id: a_decimal(suma) for categoria_id, suma in session.exec(consulta).all()}


# ---------------------------------------------------------------------------
# Funciones públicas (una por endpoint)
# ---------------------------------------------------------------------------
def resumen(session: Session, mes_anio: str) -> ResumenMes:
    """Balance global (todas las cuentas, de siempre) y flujo del mes indicado."""
    cuentas = _saldos_por_cuenta(session)
    totales = _totales_por_tipo(session, *_rango_mes(session, mes_anio))
    ingresos, gastos = totales[TipoMovimiento.INGRESO], totales[TipoMovimiento.GASTO]
    return ResumenMes(
        mes_anio=mes_anio,
        balance_global=sum((c.saldo_principal for c in cuentas), Decimal("0.00")),
        ingresos=ingresos,
        gastos=gastos,
        flujo_neto=ingresos - gastos,
        cuentas=cuentas,
    )


def flujo_mensual(session: Session, hasta_mes: str, meses: int) -> list[FlujoMensual]:
    """Ingresos y gastos de los últimos `meses` meses (para el gráfico de barras)."""
    lista_meses = _meses_anteriores(hasta_mes, meses)
    inicio, _ = _rango_mes(session, lista_meses[0])
    _, fin = _rango_mes(session, lista_meses[-1])

    # Agrupamos por mes financiero ("YYYY-MM"), calculado en SQL.
    dia_inicio = configuracion.dia_inicio_mes(session)
    mes_de_fecha = mes_financiero.expresion_mes_sql(col(Transaccion.fecha), dia_inicio)
    consulta = (
        select(mes_de_fecha, Transaccion.tipo, func.sum(Transaccion.monto_principal))
        .where(Transaccion.fecha >= inicio, Transaccion.fecha < fin)
        .group_by(mes_de_fecha, col(Transaccion.tipo))
    )
    sumas = {(mes, tipo): a_decimal(suma) for mes, tipo, suma in session.exec(consulta).all()}

    # Rellenamos con 0 los meses sin movimientos para que el gráfico no tenga huecos.
    resultado: list[FlujoMensual] = []
    for mes in lista_meses:
        ingresos = sumas.get((mes, TipoMovimiento.INGRESO), Decimal("0.00"))
        gastos = sumas.get((mes, TipoMovimiento.GASTO), Decimal("0.00"))
        resultado.append(
            FlujoMensual(mes_anio=mes, ingresos=ingresos, gastos=gastos, flujo_neto=ingresos - gastos)
        )
    return resultado


def gastos_por_categoria(session: Session, mes_anio: str) -> list[GastoPorCategoria]:
    """Reparto de los gastos del mes por categoría (para el gráfico de anillo)."""
    totales = _gastos_por_categoria_id(session, mes_anio)
    if not totales:
        return []
    total_mes = sum(totales.values(), Decimal("0.00"))
    categorias = session.exec(select(Categoria).where(col(Categoria.id).in_(totales))).all()

    resultado = [
        GastoPorCategoria(
            categoria_id=categoria.id,
            nombre=categoria.nombre,
            icono=categoria.icono,
            color=categoria.color,
            total=totales[categoria.id],
            porcentaje=_porcentaje(totales[categoria.id], total_mes),
        )
        for categoria in categorias
    ]
    return sorted(resultado, key=lambda g: g.total, reverse=True)


def progreso_presupuestos(session: Session, mes_anio: str) -> list[ProgresoPresupuesto]:
    """Cuánto se ha gastado de cada presupuesto del mes (para las barras de progreso)."""
    gastado_por_categoria = _gastos_por_categoria_id(session, mes_anio)
    consulta = (
        select(Presupuesto, Categoria)
        .join(Categoria, col(Categoria.id) == col(Presupuesto.categoria_id))
        .where(Presupuesto.mes_anio == mes_anio)
        .order_by(col(Categoria.nombre))
    )

    resultado: list[ProgresoPresupuesto] = []
    for presupuesto, categoria in session.exec(consulta).all():
        gastado = gastado_por_categoria.get(categoria.id, Decimal("0.00"))
        limite = a_decimal(presupuesto.monto_limite)
        resultado.append(
            ProgresoPresupuesto(
                presupuesto_id=presupuesto.id,
                categoria_id=categoria.id,
                nombre=categoria.nombre,
                color=categoria.color,
                mes_anio=mes_anio,
                monto_limite=limite,
                gastado=gastado,
                restante=limite - gastado,
                porcentaje=_porcentaje(gastado, limite),
                excedido=gastado > limite,
            )
        )
    return resultado
