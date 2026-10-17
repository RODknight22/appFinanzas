"""Endpoints HTTP de categorías."""

from fastapi import APIRouter, status

from app.database import SessionDep
from app.models import TipoMovimiento
from app.schemas import CategoriaCreate, CategoriaRead, CategoriaUpdate
from app.services import categorias as servicio

router = APIRouter(prefix="/categorias", tags=["Categorías"])


@router.get("", response_model=list[CategoriaRead])
def listar_categorias(session: SessionDep, tipo: TipoMovimiento | None = None):
    """Lista todas las categorías; `?tipo=gasto` filtra por tipo."""
    return servicio.listar(session, tipo)


@router.get("/{categoria_id}", response_model=CategoriaRead)
def obtener_categoria(categoria_id: int, session: SessionDep):
    return servicio.obtener(session, categoria_id)


@router.post("", response_model=CategoriaRead, status_code=status.HTTP_201_CREATED)
def crear_categoria(datos: CategoriaCreate, session: SessionDep):
    return servicio.crear(session, datos)


@router.patch("/{categoria_id}", response_model=CategoriaRead)
def actualizar_categoria(categoria_id: int, cambios: CategoriaUpdate, session: SessionDep):
    return servicio.actualizar(session, categoria_id, cambios)


@router.delete("/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_categoria(categoria_id: int, session: SessionDep) -> None:
    servicio.eliminar(session, categoria_id)
