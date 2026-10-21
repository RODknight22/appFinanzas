"""Endpoints HTTP de la lista de deseos y su máquina del tiempo."""

from fastapi import APIRouter, status

from app.database import SessionDep
from app.models import EstadoDeseo
from app.schemas import DecisionDeseo, DeseoCreate, DeseoRead, DeseoUpdate, ReflexionDeseo
from app.services import deseos as servicio

router = APIRouter(prefix="/deseos", tags=["Deseos"])


@router.get("", response_model=list[DeseoRead])
def listar_deseos(session: SessionDep, estado: EstadoDeseo | None = None):
    """Por prioridad; `?estado=en_reflexion` muestra solo los que están en la máquina del tiempo."""
    return servicio.listar(session, estado)


@router.get("/{deseo_id}", response_model=DeseoRead)
def obtener_deseo(deseo_id: int, session: SessionDep):
    return servicio.obtener(session, deseo_id)


@router.post("", response_model=DeseoRead, status_code=status.HTTP_201_CREATED)
def crear_deseo(datos: DeseoCreate, session: SessionDep):
    return servicio.crear(session, datos)


@router.patch("/{deseo_id}", response_model=DeseoRead)
def actualizar_deseo(deseo_id: int, cambios: DeseoUpdate, session: SessionDep):
    return servicio.actualizar(session, deseo_id, cambios)


@router.delete("/{deseo_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_deseo(deseo_id: int, session: SessionDep) -> None:
    servicio.eliminar(session, deseo_id)


@router.post("/{deseo_id}/decidir", response_model=DeseoRead)
def decidir(deseo_id: int, datos: DecisionDeseo, session: SessionDep):
    """Comprar, guardar en la lista o descartar (solo descartar antes de acabar la reflexión)."""
    return servicio.decidir(session, deseo_id, datos)


@router.post("/{deseo_id}/reflexionar", response_model=DeseoRead)
def reflexionar(deseo_id: int, datos: ReflexionDeseo, session: SessionDep):
    """Mete el deseo en la máquina del tiempo durante `dias`."""
    return servicio.reflexionar(session, deseo_id, datos.dias)


@router.post("/{deseo_id}/crear-meta", response_model=DeseoRead, status_code=status.HTTP_201_CREATED)
def crear_meta(deseo_id: int, session: SessionDep):
    """Crea una meta de ahorro con su precio como objetivo y la vincula al deseo."""
    deseo, _ = servicio.crear_meta(session, deseo_id)
    return deseo
