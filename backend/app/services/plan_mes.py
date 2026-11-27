"""El plan del mes: qué entra, qué está comprometido (fijos y presupuestos) y qué queda.

Todo en la moneda principal. Criterios (para no contar nada dos veces):

- Lo real son las transacciones del mes (`monto_principal`, con la tasa de su día).
- Lo previsto son las fechas de los fijos que aún no se registraron. Al registrar un
  cobro o un pago su `fecha_proximo_*` avanza, así que lo ya registrado nunca sale como
  previsto: real + previsto no se solapan.
- Previsto según el mes: pasado = nada (solo cuenta lo real); en curso = las fechas del
  mes desde hoy ("pendientes") más las del mes ya pasadas sin registrar ("atrasadas");
  futuro = todas las fechas del mes. Los atrasados de meses anteriores no se suman aquí:
  son de su mes.
- Un pago fijo pagado se reconoce por `Transaccion.suscripcion_id` o, en los anotados antes
  de existir ese campo, por la nota automática "Pago de suscripción: ...".
- Los pagos fijos de una categoría con presupuesto ya los cubre su límite: no se restan
  otra vez en "por asignar". El gasto "sin presupuesto" excluye los pagos fijos.
- Lo previsto en otra moneda se convierte con la tasa más reciente (la de hoy).
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from sqlalchemy import func, or_
from sqlmodel import Session, col, select

from app.models import Categoria, IngresoRecurrente, Moneda, Periodicidad, Suscripcion, TipoMovimiento, Transaccion
from app.schemas import GastoSinPresupuesto, PlanMes
from app.services import configuracion, dashboard, divisas, mes_financiero
from app.services.periodicidad import Calendario, calendario_de, fechas_en_rango
from app.services.saldos import a_decimal

EstadoMes = Literal["pasado", "actual", "futuro"]
# La nota que pone `suscripciones.registrar_pago`: reconoce los pagos anteriores a `suscripcion_id`.
_NOTA_PAGO_FIJO = "Pago de suscripción: "
_CERO = Decimal("0.00")


@dataclass(frozen=True)
class _Mes:
    inicio: date
    fin: date  # no incluido
    hoy: date
    estado: EstadoMes


@dataclass(frozen=True)
class _Fijo:
    """Lo común de un ingreso o pago fijo para preverlo."""

    monto: Decimal
    moneda: Moneda
    fecha_proxima: date
    periodicidad: Periodicidad
    calendario: Calendario
    categoria_id: int | None


@dataclass
class _Previsto:
    """Lo que falta de unos fijos este mes, en la moneda principal."""

    pendiente: Decimal = _CERO
    atrasado: Decimal = _CERO
    # Parte (pendiente + atrasada) en categorías con presupuesto.
    en_presupuestos: Decimal = _CERO


def _mes(session: Session, mes_anio: str, hoy: date) -> _Mes:
    inicio, fin = mes_financiero.rango_mes(mes_anio, configuracion.dia_inicio_mes(session))
    estado: EstadoMes = "pasado" if hoy >= fin else ("actual" if hoy >= inicio else "futuro")
    return _Mes(inicio, fin, hoy, estado)


def _fechas_previstas(fijo: _Fijo, mes: _Mes) -> tuple[int, int]:
    """Cuántas fechas del mes le quedan a un fijo: (pendientes, atrasadas)."""
    if mes.estado == "pasado":
        return 0, 0
    ultimo_dia = mes.fin - timedelta(days=1)
    fechas = fechas_en_rango(fijo.fecha_proxima, fijo.periodicidad, fijo.calendario, mes.inicio, ultimo_dia)
    atrasadas = sum(1 for fecha in fechas if fecha < mes.hoy) if mes.estado == "actual" else 0
    return len(fechas) - atrasadas, atrasadas


def _prever(
    session: Session, fijos: list[_Fijo], mes: _Mes, principal: Moneda, con_presupuesto: set[int]
) -> _Previsto:
    previsto = _Previsto()
    tasas_aseguradas = False
    for fijo in fijos:
        pendientes, atrasadas = _fechas_previstas(fijo, mes)
        if not pendientes and not atrasadas:
            continue
        if fijo.moneda != principal and not tasas_aseguradas:
            divisas.asegurar_tasas_del_dia(session)
            tasas_aseguradas = True
        unidad = divisas.convertir_sin_redondeo(session, fijo.monto, fijo.moneda, principal, mes.hoy)
        pendiente, atrasado = a_decimal(unidad * pendientes), a_decimal(unidad * atrasadas)
        previsto.pendiente += pendiente
        previsto.atrasado += atrasado
        if fijo.categoria_id in con_presupuesto:
            previsto.en_presupuestos += pendiente + atrasado
    return previsto


def _ingresos_fijos(session: Session, principal: Moneda) -> list[_Fijo]:
    return [
        _Fijo(i.monto, i.moneda or principal, i.fecha_proximo_cobro, i.periodicidad, calendario_de(i), i.categoria_id)
        for i in session.exec(select(IngresoRecurrente)).all()
    ]


def _pagos_fijos(session: Session, principal: Moneda) -> list[_Fijo]:
    return [
        _Fijo(s.monto, s.moneda or principal, s.fecha_proximo_pago, s.periodicidad, calendario_de(s), s.categoria_id)
        for s in session.exec(select(Suscripcion)).all()
    ]


def _reales(session: Session, mes: _Mes) -> tuple[Decimal, dict[tuple[int, bool], Decimal]]:
    """Ingresos del mes y gastos por (categoría, ¿es pago fijo?)."""
    en_mes = (Transaccion.fecha >= mes.inicio, Transaccion.fecha < mes.fin)
    ingresos = session.exec(
        select(func.sum(Transaccion.monto_principal)).where(Transaccion.tipo == TipoMovimiento.INGRESO, *en_mes)
    ).one()
    es_fijo = or_(col(Transaccion.suscripcion_id).is_not(None), col(Transaccion.notas).startswith(_NOTA_PAGO_FIJO))
    consulta = (
        select(Transaccion.categoria_id, es_fijo, func.sum(Transaccion.monto_principal))
        .where(Transaccion.tipo == TipoMovimiento.GASTO, *en_mes)
        .group_by(col(Transaccion.categoria_id), es_fijo)
    )
    gastos = {(categoria_id, bool(fijo)): a_decimal(suma) for categoria_id, fijo, suma in session.exec(consulta).all()}
    return a_decimal(ingresos), gastos


def _sin_presupuesto(session: Session, totales: dict[int, Decimal]) -> list[GastoSinPresupuesto]:
    categorias = session.exec(select(Categoria).where(col(Categoria.id).in_(totales))).all()
    lista = [
        GastoSinPresupuesto(
            categoria_id=c.id, nombre=c.nombre, icono=c.icono, color=c.color, total=totales[c.id]
        )
        for c in categorias
    ]
    return sorted(lista, key=lambda g: g.total, reverse=True)


def _porcentaje_transcurrido(mes: _Mes) -> float | None:
    """Qué parte del mes en curso ha pasado, contando hoy entero."""
    if mes.estado != "actual":
        return None
    return round(((mes.hoy - mes.inicio).days + 1) / (mes.fin - mes.inicio).days * 100, 1)


def plan_del_mes(session: Session, mes_anio: str, hoy: date | None = None) -> PlanMes:
    principal = configuracion.moneda_principal(session)
    mes = _mes(session, mes_anio, hoy or date.today())

    progreso = dashboard.progreso_presupuestos(session, mes_anio, mes.hoy)
    con_presupuesto = {p.categoria_id for p in progreso}
    limite = sum((p.limite_principal for p in progreso), _CERO)
    gastado_presupuestos = sum((p.gastado_principal for p in progreso), _CERO)

    ingresos_reales, gastos = _reales(session, mes)
    ingresos = _prever(session, _ingresos_fijos(session, principal), mes, principal, set())
    pagos = _prever(session, _pagos_fijos(session, principal), mes, principal, con_presupuesto)

    pagados = sum((total for (_, fijo), total in gastos.items() if fijo), _CERO)
    pagados_en_presupuestos = sum(
        (total for (categoria_id, fijo), total in gastos.items() if fijo and categoria_id in con_presupuesto), _CERO
    )
    sin_presupuesto: defaultdict[int, Decimal] = defaultdict(Decimal)
    for (categoria_id, fijo), total in gastos.items():
        if not fijo and categoria_id not in con_presupuesto:
            sin_presupuesto[categoria_id] += total

    ingresos_esperados = ingresos_reales + ingresos.pendiente + ingresos.atrasado
    pagos_total = pagados + pagos.pendiente + pagos.atrasado
    pagos_en_presupuestos = pagados_en_presupuestos + pagos.en_presupuestos
    gastos_reales = sum(gastos.values(), _CERO)
    return PlanMes(
        mes_anio=mes_anio,
        moneda=principal,
        estado=mes.estado,
        ingresos_reales=ingresos_reales,
        ingresos_pendientes=ingresos.pendiente,
        ingresos_atrasados=ingresos.atrasado,
        ingresos_esperados=ingresos_esperados,
        pagos_fijos_pagados=pagados,
        pagos_fijos_pendientes=pagos.pendiente,
        pagos_fijos_atrasados=pagos.atrasado,
        pagos_fijos_total=pagos_total,
        pagos_fijos_en_presupuestos=pagos_en_presupuestos,
        presupuestos_limite=limite,
        presupuestos_gastado=gastado_presupuestos,
        sin_presupuesto_total=sum(sin_presupuesto.values(), _CERO),
        sin_presupuesto=_sin_presupuesto(session, dict(sin_presupuesto)),
        gastos_reales=gastos_reales,
        por_asignar=ingresos_esperados - (pagos_total - pagos_en_presupuestos) - limite,
        disponible_real=ingresos_reales - gastos_reales,
        porcentaje_mes_transcurrido=_porcentaje_transcurrido(mes),
        porcentaje_presupuesto_gastado=round(float(gastado_presupuestos / limite * 100), 1) if limite else 0.0,
    )
