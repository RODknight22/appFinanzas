"""Endpoints HTTP de cuentas: reciben la petición y delegan en el servicio."""

from fastapi import APIRouter, status

from app.database import SessionDep
from app.schemas import AjusteSaldoCreate, AjusteSaldoRead, CuentaCreate, CuentaRead, CuentaUpdate, TransaccionRead
from app.services import cuentas as servicio

router = APIRouter(prefix="/cuentas", tags=["Cuentas"])


@router.get("", response_model=list[CuentaRead])
def listar_cuentas(session: SessionDep):
    return servicio.listar(session)


@router.get("/{cuenta_id}", response_model=CuentaRead)
def obtener_cuenta(cuenta_id: int, session: SessionDep):
    return servicio.obtener(session, cuenta_id)


@router.post("", response_model=CuentaRead, status_code=status.HTTP_201_CREATED)
def crear_cuenta(datos: CuentaCreate, session: SessionDep):
    return servicio.crear(session, datos)


@router.patch("/{cuenta_id}", response_model=CuentaRead)
def actualizar_cuenta(cuenta_id: int, cambios: CuentaUpdate, session: SessionDep):
    return servicio.actualizar(session, cuenta_id, cambios)


@router.delete("/{cuenta_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cuenta(cuenta_id: int, session: SessionDep) -> None:
    servicio.eliminar(session, cuenta_id)


@router.post(
    "/{cuenta_id}/registrar-rendimientos",
    response_model=TransaccionRead,
    status_code=status.HTTP_201_CREATED,
)
def registrar_rendimientos(cuenta_id: int, session: SessionDep):
    """Crea un ingreso con los rendimientos acumulados desde el último registro."""
    return servicio.registrar_rendimientos(session, cuenta_id)


@router.get("/{cuenta_id}/ajustes", response_model=list[AjusteSaldoRead])
def listar_ajustes(cuenta_id: int, session: SessionDep):
    return servicio.listar_ajustes(session, cuenta_id)


@router.post("/{cuenta_id}/ajustes", response_model=AjusteSaldoRead, status_code=status.HTTP_201_CREATED)
def ajustar_saldo(cuenta_id: int, datos: AjusteSaldoCreate, session: SessionDep):
    """Deja el saldo en `saldo_real` anotando la diferencia (no cuenta como ingreso ni gasto)."""
    return servicio.ajustar_saldo(session, cuenta_id, datos)


@router.delete("/{cuenta_id}/ajustes/{ajuste_id}", status_code=status.HTTP_204_NO_CONTENT)
def deshacer_ajuste(cuenta_id: int, ajuste_id: int, session: SessionDep) -> None:
    servicio.deshacer_ajuste(session, cuenta_id, ajuste_id)
