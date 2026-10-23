"""Lógica de negocio de los presupuestos mensuales."""

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.models import Categoria, Presupuesto, TipoMovimiento
from app.schemas import CopiaPresupuestos, PresupuestoCreate, PresupuestoUpdate
from app.services import configuracion
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
    presupuesto = Presupuesto.model_validate(datos)
    presupuesto.moneda = presupuesto.moneda or configuracion.moneda_principal(session)
    configuracion.comprobar_moneda_activa(session, presupuesto.moneda)
    return guardar(session, presupuesto)


def actualizar(session: Session, presupuesto_id: int, cambios: PresupuestoUpdate) -> Presupuesto:
    presupuesto = obtener(session, presupuesto_id)
    datos = cambios_parciales(cambios)
    _validar(
        session,
        datos.get("categoria_id", presupuesto.categoria_id),
        datos.get("mes_anio", presupuesto.mes_anio),
        excluir_id=presupuesto_id,
    )
    if "moneda" in datos:
        configuracion.comprobar_moneda_activa(session, datos["moneda"])
    presupuesto.sqlmodel_update(datos)
    return guardar(session, presupuesto)


def eliminar(session: Session, presupuesto_id: int) -> None:
    presupuesto = obtener(session, presupuesto_id)
    session.delete(presupuesto)
    session.commit()


# ---------------------------------------------------------------------------
# Repetir los presupuestos de un mes en otro
# ---------------------------------------------------------------------------
def _copiables(session: Session, mes_anio: str) -> tuple[str | None, list[Presupuesto]]:
    """El último mes anterior con presupuestos y los suyos cuya categoría aún no tiene en `mes_anio`.

    El último con presupuestos, no el anterior a secas: si un mes se quedó sin ellos,
    se copian igualmente los de antes.
    """
    desde = session.exec(select(func.max(Presupuesto.mes_anio)).where(Presupuesto.mes_anio < mes_anio)).one()
    if desde is None:
        return None, []
    ya_tiene = set(session.exec(select(Presupuesto.categoria_id).where(Presupuesto.mes_anio == mes_anio)).all())
    origen = session.exec(select(Presupuesto).where(Presupuesto.mes_anio == desde).order_by(col(Presupuesto.id))).all()
    return desde, [p for p in origen if p.categoria_id not in ya_tiene]


def copiables(session: Session, mes_anio: str) -> CopiaPresupuestos:
    desde, faltan = _copiables(session, mes_anio)
    return CopiaPresupuestos(desde=desde, cantidad=len(faltan))


def copiar(session: Session, mes_anio: str) -> CopiaPresupuestos:
    """Copia a `mes_anio` los que faltan, con el mismo límite y moneda. Nunca pisa los que ya hay."""
    desde, faltan = _copiables(session, mes_anio)
    session.add_all(
        Presupuesto(categoria_id=p.categoria_id, monto_limite=p.monto_limite, moneda=p.moneda, mes_anio=mes_anio)
        for p in faltan
    )
    session.commit()
    return CopiaPresupuestos(desde=desde, cantidad=len(faltan))
