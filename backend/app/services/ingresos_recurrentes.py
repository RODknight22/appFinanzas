"""Lógica de negocio de los ingresos recurrentes (nómina, rentas, envíos...)."""

from datetime import date, timedelta

from sqlmodel import Session, col, select

from app.models import Cuenta, IngresoRecurrente, IngresoRecurrenteBase, TipoMovimiento, Transaccion
from app.schemas import (
    CobroIngresoCreate,
    IngresoRecurrenteCreate,
    IngresoRecurrenteUpdate,
    OmitirCobro,
    ReconocerFijo,
)
from app.services import configuracion, fijos
from app.services.comun import cambios_parciales, guardar, obtener_o_404, obtener_referencia
from app.services.periodicidad import (
    CAMPOS_CALENDARIO,
    calendario_de,
    comprobar_fecha_prevista,
    siguiente_fecha,
    validar_calendario,
)
from app.services.transacciones import completar_montos, validar_relaciones


def listar(session: Session, proximos_dias: int | None = None) -> list[IngresoRecurrente]:
    """Lista por fecha de cobro; con `proximos_dias`, solo los que llegan pronto o van atrasados."""
    consulta = select(IngresoRecurrente).order_by(col(IngresoRecurrente.fecha_proximo_cobro))
    if proximos_dias is not None:
        limite = date.today() + timedelta(days=proximos_dias)
        consulta = consulta.where(IngresoRecurrente.fecha_proximo_cobro <= limite)
    return list(session.exec(consulta).all())


def obtener(session: Session, ingreso_id: int) -> IngresoRecurrente:
    return obtener_o_404(session, IngresoRecurrente, ingreso_id, "el ingreso recurrente")


def _validar(session: Session, ingreso: IngresoRecurrente) -> Cuenta:
    """Cuenta y categoría deben existir y la categoría ser de ingreso (si no, un 400)."""
    cuenta = validar_relaciones(session, ingreso.cuenta_id, ingreso.categoria_id, TipoMovimiento.INGRESO)
    configuracion.comprobar_moneda_activa(session, ingreso.moneda or cuenta.moneda)
    return cuenta


def crear(session: Session, datos: IngresoRecurrenteCreate) -> IngresoRecurrente:
    ingreso = IngresoRecurrente.model_validate(datos)
    validar_calendario(ingreso)
    # Lo normal es cobrar en la divisa de la cuenta (p. ej. la nómina en MXN en un banco en MXN).
    ingreso.moneda = ingreso.moneda or _validar(session, ingreso).moneda
    return guardar(session, ingreso)


def actualizar(session: Session, ingreso_id: int, cambios: IngresoRecurrenteUpdate) -> IngresoRecurrente:
    ingreso = obtener(session, ingreso_id)
    datos = cambios_parciales(cambios, anulables=CAMPOS_CALENDARIO)
    # Validamos el estado final completo (p. ej. una cuenta nueva con la categoría
    # de antes) antes de tocar el objeto, para no dejarlo a medio cambiar si falla.
    if datos.keys() & {"cuenta_id", "categoria_id", "moneda"}:
        _validar(session, ingreso.model_copy(update=datos))
    if datos.keys() & (CAMPOS_CALENDARIO | {"periodicidad"}):
        validar_calendario(ingreso.model_copy(update=datos))
    ingreso.sqlmodel_update(datos)
    return guardar(session, ingreso)


def eliminar(session: Session, ingreso_id: int) -> None:
    # Las transacciones ya cobradas se conservan: son historial real.
    session.delete(obtener(session, ingreso_id))
    session.commit()


def registrar_cobro(
    session: Session, ingreso_id: int, datos: CobroIngresoCreate
) -> tuple[Transaccion, IngresoRecurrente]:
    """Anota el ingreso que llegó y mueve el recurrente a su siguiente fecha."""
    ingreso = obtener(session, ingreso_id)
    comprobar_fecha_prevista(datos.fecha_prevista, ingreso.fecha_proximo_cobro, "cobro")
    cuenta_id = datos.cuenta_id or ingreso.cuenta_id
    cuenta = validar_relaciones(session, cuenta_id, ingreso.categoria_id, TipoMovimiento.INGRESO)

    transaccion = Transaccion(
        monto=datos.monto or ingreso.monto,
        moneda=ingreso.moneda,
        tipo=TipoMovimiento.INGRESO,
        # Por defecto el día previsto; si llegó otro día, el real (para usar su tasa).
        fecha=datos.fecha or ingreso.fecha_proximo_cobro,
        notas=datos.notas or f"Cobro: {ingreso.nombre}",
        cuenta_id=cuenta_id,
        categoria_id=ingreso.categoria_id,
        ingreso_recurrente_id=ingreso.id,
    )
    completar_montos(session, transaccion, cuenta)
    _avanzar(ingreso)

    # Un único commit: o se guardan el ingreso y la nueva fecha, o ninguno.
    session.add(transaccion)
    session.add(ingreso)
    session.commit()
    session.refresh(transaccion)
    session.refresh(ingreso)
    return transaccion, ingreso


def vincular_cobro(ingreso: IngresoRecurrente, transaccion: Transaccion, fecha_prevista: date | None) -> None:
    """Da por cobrado el periodo con un ingreso ya anotado (a mano o importado), sin crear otro.

    No hace commit: quien llama guarda todo junto (p. ej. con el resto de la importación).
    """
    comprobar_fecha_prevista(fecha_prevista, ingreso.fecha_proximo_cobro, "cobro")
    fijos.comprobar_reconocible(transaccion, TipoMovimiento.INGRESO)
    transaccion.ingreso_recurrente_id = ingreso.id
    _avanzar(ingreso)


def reconocer_cobro(session: Session, ingreso_id: int, datos: ReconocerFijo) -> IngresoRecurrente:
    """El ingreso anotado a mano era este cobro fijo: avanza su fecha para no contarlo dos veces."""
    ingreso = obtener(session, ingreso_id)
    transaccion = obtener_referencia(session, Transaccion, datos.transaccion_id, "el movimiento")
    vincular_cobro(ingreso, transaccion, datos.fecha_prevista)
    # Un único commit: el vínculo y la nueva fecha, o ninguno.
    session.add(transaccion)
    session.add(ingreso)
    session.commit()
    session.refresh(ingreso)
    return ingreso


def omitir_cobro(session: Session, ingreso_id: int, datos: OmitirCobro | None = None) -> IngresoRecurrente:
    """Salta un periodo sin anotar nada (p. ej. un mes en que no hubo pago)."""
    ingreso = obtener(session, ingreso_id)
    comprobar_fecha_prevista(datos.fecha_prevista if datos else None, ingreso.fecha_proximo_cobro, "cobro")
    _avanzar(ingreso)
    return guardar(session, ingreso)


def _avanzar(ingreso: IngresoRecurrenteBase) -> None:
    # Se avanza desde la fecha prevista, no desde la real: si la nómina del 15
    # llegó el 16, la siguiente sigue siendo el último día del mes.
    ingreso.fecha_proximo_cobro = siguiente_fecha(
        ingreso.fecha_proximo_cobro, ingreso.periodicidad, calendario_de(ingreso)
    )
