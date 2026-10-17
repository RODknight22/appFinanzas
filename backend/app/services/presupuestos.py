"""Lógica de negocio de los presupuestos mensuales."""

from sqlmodel import Session, col, select

from app.models import Categoria, Presupuesto, TipoMovimiento
from app.schemas import PresupuestoCreate, PresupuestoUpdate
from app.services.comun import cambios_parciales, guardar, obtener_o_404, obtener_referencia
from app.services.errores import ConflictoError, ReglaDeNegocioError


def listar(
    session: Session, mes_anio: str | None = None, categoria_id: int | None = None
) -> list[Presupuesto]:
    consulta = select(Presupuesto).order_by(col(Presupuesto.mes_anio).desc())
    if mes_anio is not None:
        consulta = consulta.where(Presupuesto.mes_anio == mes_anio)
    if categoria_id is not None:
        consulta = consulta.where(Presupuesto.categoria_id == categoria_id)
    return list(session.exec(consulta).all())


def obtener(session: Session, presupuesto_id: int) -> Presupuesto:
    return obtener_o_404(session, Presupuesto, presupuesto_id, "el presupuesto")


def _validar(
    session: Session, categoria_id: int, mes_anio: str, excluir_id: int | None = None
) -> None:
    """Solo se presupuestan gastos, y solo un presupuesto por categoría y mes."""
    categoria = obtener_referencia(session, Categoria, categoria_id, "la categoría")
    if categoria.tipo != TipoMovimiento.GASTO:
        raise ReglaDeNegocioError("Solo se pueden crear presupuestos para categorías de gasto")

    consulta = select(Presupuesto).where(
        Presupuesto.categoria_id == categoria_id, Presupuesto.mes_anio == mes_anio
    )
    duplicado = session.exec(consulta).first()
    if duplicado is not None and duplicado.id != excluir_id:
        raise ConflictoError(
            f"Ya existe un presupuesto para '{categoria.nombre}' en {mes_anio}"
        )


def crear(session: Session, datos: PresupuestoCreate) -> Presupuesto:
    _validar(session, datos.categoria_id, datos.mes_anio)
    return guardar(session, Presupuesto.model_validate(datos))


def actualizar(session: Session, presupuesto_id: int, cambios: PresupuestoUpdate) -> Presupuesto:
    presupuesto = obtener(session, presupuesto_id)
    datos = cambios_parciales(cambios)
    _validar(
        session,
        datos.get("categoria_id", presupuesto.categoria_id),
        datos.get("mes_anio", presupuesto.mes_anio),
        excluir_id=presupuesto_id,
    )
    presupuesto.sqlmodel_update(datos)
    return guardar(session, presupuesto)


def eliminar(session: Session, presupuesto_id: int) -> None:
    presupuesto = obtener(session, presupuesto_id)
    session.delete(presupuesto)
    session.commit()
