"""Lógica de negocio de las categorías."""

from sqlmodel import Session, col, select

from app.models import Categoria, Presupuesto, TipoMovimiento, Transaccion
from app.schemas import CategoriaCreate, CategoriaUpdate
from app.services.comun import cambios_parciales, existe, guardar, obtener_o_404
from app.services.errores import ConflictoError


def listar(session: Session, tipo: TipoMovimiento | None = None) -> list[Categoria]:
    consulta = select(Categoria).order_by(col(Categoria.nombre))
    if tipo is not None:
        consulta = consulta.where(Categoria.tipo == tipo)
    return list(session.exec(consulta).all())


def obtener(session: Session, categoria_id: int) -> Categoria:
    return obtener_o_404(session, Categoria, categoria_id, "la categoría")


def _comprobar_nombre_libre(
    session: Session, nombre: str, tipo: TipoMovimiento, excluir_id: int | None = None
) -> None:
    """Evita duplicados con un mensaje claro (en vez de un error genérico de la BD)."""
    consulta = select(Categoria).where(Categoria.nombre == nombre, Categoria.tipo == tipo)
    duplicada = session.exec(consulta).first()
    if duplicada is not None and duplicada.id != excluir_id:
        raise ConflictoError(f"Ya existe una categoría de {tipo.value} llamada '{nombre}'")


def crear(session: Session, datos: CategoriaCreate) -> Categoria:
    _comprobar_nombre_libre(session, datos.nombre, datos.tipo)
    return guardar(session, Categoria.model_validate(datos))


def actualizar(session: Session, categoria_id: int, cambios: CategoriaUpdate) -> Categoria:
    categoria = obtener(session, categoria_id)
    datos = cambios_parciales(cambios)

    nuevo_tipo = datos.get("tipo", categoria.tipo)
    if nuevo_tipo != categoria.tipo:
        # Cambiar el tipo convertiría gastos ya registrados en ingresos (o al revés).
        if existe(session, Transaccion.categoria_id, categoria_id):
            raise ConflictoError("No se puede cambiar el tipo de una categoría con transacciones")
        if existe(session, Presupuesto.categoria_id, categoria_id):
            raise ConflictoError("No se puede cambiar el tipo de una categoría con presupuestos")

    _comprobar_nombre_libre(
        session, datos.get("nombre", categoria.nombre), nuevo_tipo, excluir_id=categoria_id
    )
    categoria.sqlmodel_update(datos)
    return guardar(session, categoria)


def eliminar(session: Session, categoria_id: int) -> None:
    categoria = obtener(session, categoria_id)
    if existe(session, Transaccion.categoria_id, categoria_id):
        raise ConflictoError("No se puede eliminar una categoría que tiene transacciones")
    if existe(session, Presupuesto.categoria_id, categoria_id):
        raise ConflictoError("No se puede eliminar una categoría que tiene presupuestos")
    session.delete(categoria)
    session.commit()
