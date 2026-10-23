"""Endpoints HTTP de las reglas de categoría para importar extractos."""

from fastapi import APIRouter, status

from app.database import SessionDep
from app.schemas import ReglaCategoriaCreate, ReglaCategoriaRead, ReglaCategoriaUpdate
from app.services import reglas_categoria as servicio

router = APIRouter(prefix="/reglas-categoria", tags=["Reglas de categoría"])


@router.get("", response_model=list[ReglaCategoriaRead])
def listar_reglas(session: SessionDep):
    """Todas las reglas, por orden alfabético del texto."""
    return servicio.listar(session)


@router.post("", response_model=ReglaCategoriaRead, status_code=status.HTTP_201_CREATED)
def crear_regla(datos: ReglaCategoriaCreate, session: SessionDep):
    return servicio.crear(session, datos)


@router.patch("/{regla_id}", response_model=ReglaCategoriaRead)
def actualizar_regla(regla_id: int, cambios: ReglaCategoriaUpdate, session: SessionDep):
    return servicio.actualizar(session, regla_id, cambios)


@router.delete("/{regla_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_regla(regla_id: int, session: SessionDep) -> None:
    servicio.eliminar(session, regla_id)
