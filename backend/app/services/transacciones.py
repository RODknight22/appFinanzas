"""Lógica de negocio de las transacciones."""

from datetime import date

from sqlmodel import Session, col, select

from app.models import Categoria, Cuenta, TipoMovimiento, Transaccion
from app.schemas import TransaccionCreate, TransaccionUpdate
from app.services.comun import cambios_parciales, guardar, obtener_o_404, obtener_referencia
from app.services.errores import ReglaDeNegocioError


def listar(
    session: Session,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    tipo: TipoMovimiento | None = None,
    cuenta_id: int | None = None,
    categoria_id: int | None = None,
    offset: int = 0,
    limit: int = 100,
) -> list[Transaccion]:
    """Lista transacciones (las más recientes primero) aplicando solo los filtros dados."""
    consulta = select(Transaccion)
    if desde is not None:
        consulta = consulta.where(Transaccion.fecha >= desde)
    if hasta is not None:
        consulta = consulta.where(Transaccion.fecha <= hasta)
    if tipo is not None:
        consulta = consulta.where(Transaccion.tipo == tipo)
    if cuenta_id is not None:
        consulta = consulta.where(Transaccion.cuenta_id == cuenta_id)
    if categoria_id is not None:
        consulta = consulta.where(Transaccion.categoria_id == categoria_id)

    consulta = (
        consulta.order_by(col(Transaccion.fecha).desc(), col(Transaccion.id).desc())
        .offset(offset)
        .limit(limit)
    )
    return list(session.exec(consulta).all())


def obtener(session: Session, transaccion_id: int) -> Transaccion:
    return obtener_o_404(session, Transaccion, transaccion_id, "la transacción")


def validar_relaciones(
    session: Session, cuenta_id: int, categoria_id: int, tipo: TipoMovimiento
) -> None:
    """Comprueba que la cuenta y la categoría existen y que el tipo es coherente."""
    obtener_referencia(session, Cuenta, cuenta_id, "la cuenta")
    categoria = obtener_referencia(session, Categoria, categoria_id, "la categoría")
    if categoria.tipo != tipo:
        raise ReglaDeNegocioError(
            f"La categoría '{categoria.nombre}' es de {categoria.tipo.value}, "
            f"no se puede usar en una transacción de {tipo.value}"
        )


def crear(session: Session, datos: TransaccionCreate) -> Transaccion:
    validar_relaciones(session, datos.cuenta_id, datos.categoria_id, datos.tipo)
    return guardar(session, Transaccion.model_validate(datos))


def actualizar(session: Session, transaccion_id: int, cambios: TransaccionUpdate) -> Transaccion:
    transaccion = obtener(session, transaccion_id)
    datos = cambios_parciales(cambios, anulables=frozenset({"notas"}))

    # Validamos la combinación final (valores nuevos + los que no cambian),
    # porque un PATCH puede cambiar solo el tipo o solo la categoría.
    validar_relaciones(
        session,
        datos.get("cuenta_id", transaccion.cuenta_id),
        datos.get("categoria_id", transaccion.categoria_id),
        datos.get("tipo", transaccion.tipo),
    )
    transaccion.sqlmodel_update(datos)
    return guardar(session, transaccion)


def eliminar(session: Session, transaccion_id: int) -> None:
    transaccion = obtener(session, transaccion_id)
    session.delete(transaccion)
    session.commit()
