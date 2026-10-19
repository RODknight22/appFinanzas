"""Endpoints HTTP de transacciones."""

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.database import SessionDep
from app.models import TipoMovimiento
from app.schemas import PaginaTransacciones, TransaccionCreate, TransaccionRead, TransaccionUpdate
from app.services import transacciones as servicio
from app.services.transacciones import FiltrosTransacciones

router = APIRouter(prefix="/transacciones", tags=["Transacciones"])


def filtros(
    desde: date | None = None,
    hasta: date | None = None,
    tipo: TipoMovimiento | None = None,
    cuenta_id: int | None = None,
    categoria_id: int | None = None,
    texto: Annotated[str | None, Query(max_length=100)] = None,
    monto_min: Annotated[Decimal | None, Query(ge=0)] = None,
    monto_max: Annotated[Decimal | None, Query(ge=0)] = None,
) -> FiltrosTransacciones:
    """Dependencia: convierte los parámetros de la URL en un objeto de filtros.

    Así /transacciones y /transacciones/buscar aceptan exactamente los mismos.
    """
    return FiltrosTransacciones(desde, hasta, tipo, cuenta_id, categoria_id, texto, monto_min, monto_max)


FiltrosDep = Annotated[FiltrosTransacciones, Depends(filtros)]


@router.get("", response_model=list[TransaccionRead])
def listar_transacciones(
    session: SessionDep,
    filtros: FiltrosDep,
    # Paginación: evita devolver miles de filas de golpe.
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
):
    """Lista transacciones, de la más reciente a la más antigua, con filtros opcionales."""
    return servicio.listar(session, filtros, offset=offset, limit=limit)


# Va antes de "/{transaccion_id}": si no, FastAPI intentaría leer "buscar" como un id.
@router.get("/buscar", response_model=PaginaTransacciones)
def buscar_transacciones(
    session: SessionDep,
    filtros: FiltrosDep,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
):
    """Una página de resultados con el total de coincidencias y la suma de ingresos y gastos."""
    return servicio.buscar(session, filtros, offset=offset, limit=limit)


@router.get("/{transaccion_id}", response_model=TransaccionRead)
def obtener_transaccion(transaccion_id: int, session: SessionDep):
    return servicio.obtener(session, transaccion_id)


@router.post("", response_model=TransaccionRead, status_code=status.HTTP_201_CREATED)
def crear_transaccion(datos: TransaccionCreate, session: SessionDep):
    return servicio.crear(session, datos)


@router.patch("/{transaccion_id}", response_model=TransaccionRead)
def actualizar_transaccion(transaccion_id: int, cambios: TransaccionUpdate, session: SessionDep):
    return servicio.actualizar(session, transaccion_id, cambios)


@router.delete("/{transaccion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_transaccion(transaccion_id: int, session: SessionDep) -> None:
    servicio.eliminar(session, transaccion_id)
