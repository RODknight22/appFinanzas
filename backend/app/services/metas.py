"""Lógica de negocio de las metas de ahorro y sus aportaciones."""

import math
from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.models import AportacionMeta, Cuenta, Meta
from app.schemas import AportacionMetaCreate, MetaCreate, MetaRead, MetaUpdate
from app.services import configuracion, divisas
from app.services.comun import cambios_parciales, existe, obtener_o_404, obtener_referencia
from app.services.errores import ConflictoError, ReglaDeNegocioError
from app.services.saldos import CENTIMOS, a_decimal, saldo_actual

# Duración media de un mes (365.25 / 12): para pasar días a meses sin calendario.
_DIAS_POR_MES = 30.4375


# ---------------------------------------------------------------------------
# Progreso
# ---------------------------------------------------------------------------
def _ahorrado(session: Session, meta: Meta, hoy: date) -> Decimal:
    """Con cuenta: su saldo (convertido a la moneda de la meta). Sin cuenta: sus aportaciones."""
    if meta.cuenta_id is not None:
        cuenta = session.get(Cuenta, meta.cuenta_id)
        if cuenta.moneda != meta.moneda:
            divisas.asegurar_tasas_del_dia(session)
        # Un saldo es dinero de hoy: se convierte con la tasa de hoy.
        return divisas.convertir(session, saldo_actual(session, cuenta), cuenta.moneda, meta.moneda, hoy)
    suma = session.exec(select(func.sum(AportacionMeta.monto)).where(AportacionMeta.meta_id == meta.id)).one()
    return a_decimal(suma)


def _con_progreso(session: Session, meta: Meta, hoy: date) -> MetaRead:
    """Calcula el progreso y, si se acaba de alcanzar el objetivo, anota el día.

    Modifica `meta.fecha_cumplida` sin hacer commit: lo hace quien llama.
    """
    ahorrado = _ahorrado(session, meta, hoy)
    if ahorrado >= meta.monto_objetivo and meta.fecha_cumplida is None:
        meta.fecha_cumplida = hoy
        session.add(meta)

    cumplida = meta.fecha_cumplida is not None
    restante = max(meta.monto_objetivo - ahorrado, Decimal("0.00"))
    vencida, meses, mensual = False, None, None
    if meta.fecha_limite is not None and not cumplida:
        dias = (meta.fecha_limite - hoy).days
        vencida = dias < 0
        if not vencida:
            # Al menos 1: si la fecha es este mes, hay que apartarlo todo ya.
            meses = max(1, math.ceil(dias / _DIAS_POR_MES))
            mensual = (restante / meses).quantize(CENTIMOS)

    return MetaRead.model_validate(
        meta,
        update={
            "ahorrado": ahorrado,
            "restante": restante,
            "porcentaje": round(float(max(ahorrado, Decimal(0)) / meta.monto_objetivo * 100), 1),
            "cumplida": cumplida,
            "vencida": vencida,
            "meses_restantes": meses,
            "ahorro_mensual": mensual,
        },
    )


# ---------------------------------------------------------------------------
# CRUD de metas
# ---------------------------------------------------------------------------
def _obtener_tabla(session: Session, meta_id: int) -> Meta:
    return obtener_o_404(session, Meta, meta_id, "la meta")


def _guardar_y_leer(session: Session, meta: Meta, hoy: date | None = None) -> MetaRead:
    hoy = hoy or date.today()
    session.add(meta)
    session.flush()  # asigna el id antes de calcular el progreso
    leida = _con_progreso(session, meta, hoy)
    session.commit()
    return leida


def listar(session: Session, hoy: date | None = None) -> list[MetaRead]:
    """Activas primero (las de fecha más cercana arriba) y después las cumplidas."""
    hoy = hoy or date.today()
    metas = session.exec(select(Meta).order_by(col(Meta.nombre))).all()
    leidas = [_con_progreso(session, meta, hoy) for meta in metas]
    session.commit()  # guarda las fechas de cumplimiento que se acaben de anotar
    return sorted(leidas, key=lambda m: (m.cumplida, m.fecha_limite or date.max))


def obtener(session: Session, meta_id: int, hoy: date | None = None) -> MetaRead:
    return _guardar_y_leer(session, _obtener_tabla(session, meta_id), hoy)


def _preparar_cuenta_y_moneda(session: Session, meta: Meta) -> None:
    """Valida la cuenta vinculada y elige la moneda por defecto."""
    cuenta = obtener_referencia(session, Cuenta, meta.cuenta_id, "la cuenta") if meta.cuenta_id else None
    meta.moneda = meta.moneda or (cuenta.moneda if cuenta else configuracion.moneda_principal(session))
    configuracion.comprobar_moneda_activa(session, meta.moneda)


def crear(session: Session, datos: MetaCreate, hoy: date | None = None) -> MetaRead:
    meta = Meta.model_validate(datos)
    _preparar_cuenta_y_moneda(session, meta)
    return _guardar_y_leer(session, meta, hoy)


def actualizar(session: Session, meta_id: int, cambios: MetaUpdate, hoy: date | None = None) -> MetaRead:
    meta = _obtener_tabla(session, meta_id)
    datos = cambios_parciales(cambios, anulables=frozenset({"fecha_limite", "cuenta_id"}))
    cumplida = datos.pop("cumplida", None)

    tiene_aportaciones = existe(session, AportacionMeta.meta_id, meta_id)
    if tiene_aportaciones and datos.get("cuenta_id") is not None:
        raise ConflictoError("Esta meta tiene aportaciones: bórralas antes de vincularla a una cuenta")
    if tiene_aportaciones and datos.get("moneda", meta.moneda) != meta.moneda:
        raise ConflictoError("No se puede cambiar la moneda de una meta con aportaciones")

    meta.sqlmodel_update(datos)
    _preparar_cuenta_y_moneda(session, meta)
    # Un objetivo nuevo (o reabrirla) se vuelve a evaluar desde cero.
    if "monto_objetivo" in datos or cumplida is False:
        meta.fecha_cumplida = None
    if cumplida is True and meta.fecha_cumplida is None:
        meta.fecha_cumplida = hoy or date.today()
    return _guardar_y_leer(session, meta, hoy)


def eliminar(session: Session, meta_id: int) -> None:
    meta = _obtener_tabla(session, meta_id)
    for aportacion in session.exec(select(AportacionMeta).where(AportacionMeta.meta_id == meta_id)).all():
        session.delete(aportacion)
    session.delete(meta)
    session.commit()


# ---------------------------------------------------------------------------
# Aportaciones (solo metas sin cuenta vinculada)
# ---------------------------------------------------------------------------
def listar_aportaciones(session: Session, meta_id: int) -> list[AportacionMeta]:
    _obtener_tabla(session, meta_id)
    consulta = (
        select(AportacionMeta)
        .where(AportacionMeta.meta_id == meta_id)
        .order_by(col(AportacionMeta.fecha).desc(), col(AportacionMeta.id).desc())
    )
    return list(session.exec(consulta).all())


def crear_aportacion(session: Session, meta_id: int, datos: AportacionMetaCreate) -> AportacionMeta:
    meta = _obtener_tabla(session, meta_id)
    if meta.cuenta_id is not None:
        raise ConflictoError("Esta meta sigue el saldo de su cuenta: no admite aportaciones a mano")
    if datos.monto < 0 and _ahorrado(session, meta, date.today()) + datos.monto < 0:
        raise ReglaDeNegocioError("No puedes retirar más de lo que llevas ahorrado en esta meta")

    aportacion = AportacionMeta.model_validate(datos, update={"meta_id": meta_id})
    session.add(aportacion)
    session.flush()
    _con_progreso(session, meta, date.today())  # puede dejarla cumplida
    session.commit()
    session.refresh(aportacion)
    return aportacion


def eliminar_aportacion(session: Session, meta_id: int, aportacion_id: int) -> None:
    aportacion = obtener_o_404(session, AportacionMeta, aportacion_id, "la aportación")
    if aportacion.meta_id != meta_id:
        raise ReglaDeNegocioError("Esa aportación no pertenece a esta meta")
    session.delete(aportacion)
    session.commit()
