"""Endpoints de solo lectura que alimentan el dashboard del frontend."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.database import SessionDep
from app.schemas import (
    FlujoMensual,
    GastoDiario,
    GastoPorCategoria,
    ProgresoPresupuesto,
    PuntoPatrimonio,
    ResumenMes,
)
from app.services import dashboard as servicio

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# Si no se indica el mes, se usa el actual.
MesParam = Annotated[str | None, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]


@router.get("/resumen", response_model=ResumenMes)
def resumen(session: SessionDep, mes_anio: MesParam = None):
    """Balance global, saldo por cuenta e ingresos/gastos/flujo neto del mes."""
    return servicio.resumen(session, mes_anio or servicio.mes_actual(session))


@router.get("/flujo-mensual", response_model=list[FlujoMensual])
def flujo_mensual(
    session: SessionDep,
    hasta_mes: MesParam = None,
    meses: Annotated[int, Query(ge=1, le=24)] = 6,
):
    """Ingresos vs. gastos de los últimos `meses` meses, terminando en `hasta_mes`."""
    return servicio.flujo_mensual(session, hasta_mes or servicio.mes_actual(session), meses)


@router.get("/gastos-por-categoria", response_model=list[GastoPorCategoria])
def gastos_por_categoria(session: SessionDep, mes_anio: MesParam = None):
    """Gastos del mes agrupados por categoría, de mayor a menor."""
    return servicio.gastos_por_categoria(session, mes_anio or servicio.mes_actual(session))


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
