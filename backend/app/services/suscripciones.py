"""Lógica de negocio de las suscripciones y gastos recurrentes."""

from datetime import date, timedelta

from sqlmodel import Session, col, select

from app.models import Suscripcion, TipoMovimiento, Transaccion
from app.schemas import PagoSuscripcionCreate, SuscripcionCreate, SuscripcionUpdate
from app.services import configuracion
from app.services.comun import cambios_parciales, guardar, obtener_o_404
from app.services.periodicidad import siguiente_fecha
from app.services.transacciones import completar_montos, validar_relaciones


def listar(session: Session, proximos_dias: int | None = None) -> list[Suscripcion]:
    """Lista por fecha de cobro (la más cercana primero).

    Con `proximos_dias` solo devuelve los cobros que vencen en ese plazo
    (incluidos los atrasados), que es lo que necesita un recordatorio.
    """
    consulta = select(Suscripcion).order_by(col(Suscripcion.fecha_proximo_pago))
    if proximos_dias is not None:
        limite = date.today() + timedelta(days=proximos_dias)
        consulta = consulta.where(Suscripcion.fecha_proximo_pago <= limite)
    return list(session.exec(consulta).all())


def obtener(session: Session, suscripcion_id: int) -> Suscripcion:
    return obtener_o_404(session, Suscripcion, suscripcion_id, "la suscripción")


def crear(session: Session, datos: SuscripcionCreate) -> Suscripcion:
    suscripcion = Suscripcion.model_validate(datos)
    suscripcion.moneda = suscripcion.moneda or configuracion.moneda_principal(session)
    configuracion.comprobar_moneda_activa(session, suscripcion.moneda)
    return guardar(session, suscripcion)


def actualizar(session: Session, suscripcion_id: int, cambios: SuscripcionUpdate) -> Suscripcion:
    suscripcion = obtener(session, suscripcion_id)
    datos = cambios_parciales(cambios)
    if "moneda" in datos:
        configuracion.comprobar_moneda_activa(session, datos["moneda"])
    suscripcion.sqlmodel_update(datos)
    return guardar(session, suscripcion)


def eliminar(session: Session, suscripcion_id: int) -> None:
    # Las transacciones ya creadas por sus cobros se conservan: son historial real.
    session.delete(obtener(session, suscripcion_id))
    session.commit()


def registrar_pago(
    session: Session, suscripcion_id: int, datos: PagoSuscripcionCreate
) -> tuple[Transaccion, Suscripcion]:
    """Anota el cobro como gasto y mueve la suscripción a su siguiente fecha."""
    suscripcion = obtener(session, suscripcion_id)
    cuenta = validar_relaciones(session, datos.cuenta_id, datos.categoria_id, TipoMovimiento.GASTO)

    transaccion = Transaccion(
        monto=suscripcion.monto,
        moneda=suscripcion.moneda,
        tipo=TipoMovimiento.GASTO,
        fecha=suscripcion.fecha_proximo_pago,
        notas=f"Pago de suscripción: {suscripcion.nombre}",
        cuenta_id=datos.cuenta_id,
        categoria_id=datos.categoria_id,
    )
    # Con la tasa del día del cobro: p. ej. Netflix en USD pagado con una cuenta en MXN.
    completar_montos(session, transaccion, cuenta)
    suscripcion.fecha_proximo_pago = siguiente_fecha(
        suscripcion.fecha_proximo_pago, suscripcion.periodicidad
    )

    # Un único commit para ambos cambios: o se guardan los dos o ninguno.
    session.add(transaccion)
    session.add(suscripcion)
    session.commit()
    session.refresh(transaccion)
    session.refresh(suscripcion)
    return transaccion, suscripcion
