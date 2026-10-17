"""Lógica de negocio de las cuentas."""

from sqlmodel import Session, col, select

from app.models import Cuenta, Transaccion
from app.schemas import CuentaCreate, CuentaUpdate
from app.services.comun import cambios_parciales, existe, guardar, obtener_o_404
from app.services.errores import ConflictoError


def listar(session: Session) -> list[Cuenta]:
    return list(session.exec(select(Cuenta).order_by(col(Cuenta.nombre))).all())


def obtener(session: Session, cuenta_id: int) -> Cuenta:
    return obtener_o_404(session, Cuenta, cuenta_id, "la cuenta")


def crear(session: Session, datos: CuentaCreate) -> Cuenta:
    return guardar(session, Cuenta.model_validate(datos))


def actualizar(session: Session, cuenta_id: int, cambios: CuentaUpdate) -> Cuenta:
    cuenta = obtener(session, cuenta_id)
    cuenta.sqlmodel_update(cambios_parciales(cambios))
    return guardar(session, cuenta)


def eliminar(session: Session, cuenta_id: int) -> None:
    cuenta = obtener(session, cuenta_id)
    # Borrarla dejaría transacciones huérfanas y descuadraría el balance.
    if existe(session, Transaccion.cuenta_id, cuenta_id):
        raise ConflictoError("No se puede eliminar una cuenta que tiene transacciones")
    session.delete(cuenta)
    session.commit()
