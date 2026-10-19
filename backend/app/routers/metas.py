"""Endpoints HTTP de metas de ahorro y sus aportaciones."""

from fastapi import APIRouter, status

from app.database import SessionDep
from app.schemas import AportacionMetaCreate, AportacionMetaRead, MetaCreate, MetaRead, MetaUpdate
from app.services import metas as servicio

router = APIRouter(prefix="/metas", tags=["Metas de ahorro"])


@router.get("", response_model=list[MetaRead])
def listar_metas(session: SessionDep):
    """Metas con su progreso: activas primero y después las cumplidas."""
    return servicio.listar(session)


@router.get("/{meta_id}", response_model=MetaRead)
def obtener_meta(meta_id: int, session: SessionDep):
    return servicio.obtener(session, meta_id)


@router.post("", response_model=MetaRead, status_code=status.HTTP_201_CREATED)
def crear_meta(datos: MetaCreate, session: SessionDep):
    return servicio.crear(session, datos)


@router.patch("/{meta_id}", response_model=MetaRead)
def actualizar_meta(meta_id: int, cambios: MetaUpdate, session: SessionDep):
    return servicio.actualizar(session, meta_id, cambios)


@router.delete("/{meta_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_meta(meta_id: int, session: SessionDep) -> None:
    """Borra la meta y sus aportaciones (el dinero de tus cuentas no cambia)."""
    servicio.eliminar(session, meta_id)


@router.get("/{meta_id}/aportaciones", response_model=list[AportacionMetaRead])
def listar_aportaciones(meta_id: int, session: SessionDep):
    return servicio.listar_aportaciones(session, meta_id)


@router.post("/{meta_id}/aportaciones", response_model=AportacionMetaRead, status_code=status.HTTP_201_CREATED)
def crear_aportacion(meta_id: int, datos: AportacionMetaCreate, session: SessionDep):
    """Aparta dinero para la meta (o lo retira, con un importe negativo)."""
    return servicio.crear_aportacion(session, meta_id, datos)


@router.delete("/{meta_id}/aportaciones/{aportacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_aportacion(meta_id: int, aportacion_id: int, session: SessionDep) -> None:
    servicio.eliminar_aportacion(session, meta_id, aportacion_id)
