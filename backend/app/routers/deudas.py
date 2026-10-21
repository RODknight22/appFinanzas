"""Endpoints HTTP de deudas (quién te debe y a quién le debes) y sus abonos."""

from fastapi import APIRouter, status

from app.database import SessionDep
from app.models import SentidoDeuda
from app.schemas import AbonoDeudaCreate, DeudaCreate, DeudaRead, DeudaUpdate
from app.services import deudas as servicio

router = APIRouter(prefix="/deudas", tags=["Deudas"])


@router.get("", response_model=list[DeudaRead])
def listar_deudas(session: SessionDep, sentido: SentidoDeuda | None = None, pendientes: bool | None = None):
    """`?sentido=me_deben` o `debo`; `?pendientes=true` oculta las saldadas."""
    return servicio.listar(session, sentido, pendientes)


@router.get("/{deuda_id}", response_model=DeudaRead)
def obtener_deuda(deuda_id: int, session: SessionDep):
    return servicio.obtener(session, deuda_id)


@router.post("", response_model=DeudaRead, status_code=status.HTTP_201_CREATED)
def crear_deuda(datos: DeudaCreate, session: SessionDep):
    return servicio.crear(session, datos)


@router.patch("/{deuda_id}", response_model=DeudaRead)
def actualizar_deuda(deuda_id: int, cambios: DeudaUpdate, session: SessionDep):
    return servicio.actualizar(session, deuda_id, cambios)


@router.delete("/{deuda_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_deuda(deuda_id: int, session: SessionDep) -> None:
    servicio.eliminar(session, deuda_id)


@router.post("/{deuda_id}/abonos", response_model=DeudaRead, status_code=status.HTTP_201_CREATED)
def abonar(deuda_id: int, datos: AbonoDeudaCreate, session: SessionDep):
    """Anota una devolución y devuelve la deuda actualizada."""
    return servicio.abonar(session, deuda_id, datos)


@router.delete("/{deuda_id}/abonos/{abono_id}", response_model=DeudaRead)
def eliminar_abono(deuda_id: int, abono_id: int, session: SessionDep):
    return servicio.eliminar_abono(session, deuda_id, abono_id)
