"""Endpoints de solo lectura que alimentan el dashboard del frontend."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.database import SessionDep
from app.schemas import (
    AhorroAnual,
    ComparativaPeriodo,
    FlujoMensual,
    GastoDiario,
    GastoPorCategoria,
    GastoPorComercio,
    GastoPorCuenta,
    PoderAdquisitivo,
    ProgresoPresupuesto,
    PuntoPatrimonio,
    ResumenMes,
)
from app.services import dashboard as servicio

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# Si no se indica el mes, se usa el actual.
MesParam = Annotated[str | None, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]
# Rango libre ("últimos 7 días"): los dos días incluidos. Sin ellos, el mes.
FechaParam = Annotated[date | None, Query()]


def _periodo(
    session: SessionDep, mes_anio: MesParam = None, desde: FechaParam = None, hasta: FechaParam = None
) -> servicio.Periodo:
    """El periodo pedido: `desde`/`hasta` si vienen; si no, el mes (el actual por defecto)."""
    return servicio.resolver_periodo(session, mes_anio or servicio.mes_actual(session), desde, hasta)


PeriodoDep = Annotated[servicio.Periodo, Depends(_periodo)]


@router.get("/resumen", response_model=ResumenMes)
def resumen(session: SessionDep, periodo: PeriodoDep):
    """Balance global, saldo por cuenta e ingresos/gastos/flujo neto del mes o del periodo."""
    return servicio.resumen(session, periodo.mes_anio, periodo)


@router.get("/flujo-mensual", response_model=list[FlujoMensual])
def flujo_mensual(
    session: SessionDep,
    hasta_mes: MesParam = None,
    meses: Annotated[int, Query(ge=1, le=24)] = 6,
):
    """Ingresos vs. gastos de los últimos `meses` meses, terminando en `hasta_mes`."""
    return servicio.flujo_mensual(session, hasta_mes or servicio.mes_actual(session), meses)


@router.get("/gastos-por-categoria", response_model=list[GastoPorCategoria])
def gastos_por_categoria(session: SessionDep, periodo: PeriodoDep):
    """Gastos del mes (o del periodo) agrupados por categoría, de mayor a menor."""
    return servicio.gastos_por_categoria(session, periodo.mes_anio, periodo)


@router.get("/comparativa", response_model=ComparativaPeriodo)
def comparativa(session: SessionDep, periodo: PeriodoDep):
    """Ingresos y gastos del periodo frente al anterior, con su variación en %."""
    return servicio.comparativa(session, periodo)


@router.get("/top-comercios", response_model=list[GastoPorComercio])
def top_comercios(session: SessionDep, periodo: PeriodoDep, limite: Annotated[int, Query(ge=1, le=20)] = 5):
    """Dónde más se gastó en el periodo, agrupando por la descripción de cada gasto."""
    return servicio.top_comercios(session, periodo, limite)


@router.get("/gastos-por-cuenta", response_model=list[GastoPorCuenta])
def gastos_por_cuenta(session: SessionDep, periodo: PeriodoDep):
    """Reparto del gasto del periodo entre cuentas, de mayor a menor."""
    return servicio.gastos_por_cuenta(session, periodo)


@router.get("/ahorro-anual", response_model=AhorroAnual)
def ahorro_anual(session: SessionDep, anio: Annotated[int | None, Query(ge=2000, le=2100)] = None):
    """Ingresos − gastos de cada mes del año (el actual por defecto) y su acumulado."""
    return servicio.ahorro_anual(session, anio or int(servicio.mes_actual(session)[:4]))


@router.get("/presupuestos", response_model=list[ProgresoPresupuesto])
def progreso_presupuestos(session: SessionDep, mes_anio: MesParam = None):
    """Consumo de cada presupuesto del mes: gastado, restante y porcentaje."""
    return servicio.progreso_presupuestos(session, mes_anio or servicio.mes_actual(session))


@router.get("/patrimonio", response_model=list[PuntoPatrimonio])
def patrimonio(
    session: SessionDep,
    hasta_mes: MesParam = None,
    meses: Annotated[int, Query(ge=1, le=36)] = 12,
):
    """Dinero total al cierre de cada mes (para la gráfica de evolución)."""
    return servicio.patrimonio(session, hasta_mes or servicio.mes_actual(session), meses)


@router.get("/gastos-diarios", response_model=list[GastoDiario])
def gastos_diarios(session: SessionDep, mes_anio: MesParam = None):
    """Gasto de cada día del mes (para el calendario de gastos)."""
    return servicio.gastos_diarios(session, mes_anio or servicio.mes_actual(session))


@router.get("/poder-adquisitivo", response_model=PoderAdquisitivo)
def poder_adquisitivo(session: SessionDep, mes_anio: MesParam = None):
    """Cuánto rinden tus ingresos de una moneda al gastar en otra, este mes frente a 12."""
    return servicio.poder_adquisitivo(session, mes_anio or servicio.mes_actual(session))
