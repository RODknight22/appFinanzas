"""Lógica de negocio de las suscripciones y gastos recurrentes."""

import calendar
from datetime import date, timedelta

from sqlmodel import Session, col, select

from app.models import Periodicidad, Suscripcion, TipoMovimiento, Transaccion
from app.schemas import PagoSuscripcionCreate, SuscripcionCreate, SuscripcionUpdate
from app.services.comun import cambios_parciales, guardar, obtener_o_404
from app.services.transacciones import validar_relaciones


def _sumar_meses(fecha: date, meses: int) -> date:
    """Suma meses respetando los meses cortos: 31 ene + 1 mes = 28/29 feb."""
    total = fecha.month - 1 + meses
    anio, mes = fecha.year + total // 12, total % 12 + 1
    ultimo_dia = calendar.monthrange(anio, mes)[1]
    return date(anio, mes, min(fecha.day, ultimo_dia))


def siguiente_fecha(fecha: date, periodicidad: Periodicidad) -> date:
    """Calcula la fecha del próximo cobro a partir de la actual."""
    if periodicidad == Periodicidad.SEMANAL:
        return fecha + timedelta(weeks=1)
    if periodicidad == Periodicidad.MENSUAL:
        return _sumar_meses(fecha, 1)
    return _sumar_meses(fecha, 12)


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
    return guardar(session, Suscripcion.model_validate(datos))


def actualizar(session: Session, suscripcion_id: int, cambios: SuscripcionUpdate) -> Suscripcion:
    suscripcion = obtener(session, suscripcion_id)
    suscripcion.sqlmodel_update(cambios_parciales(cambios))
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
    validar_relaciones(session, datos.cuenta_id, datos.categoria_id, TipoMovimiento.GASTO)

    transaccion = Transaccion(
        monto=suscripcion.monto,
        tipo=TipoMovimiento.GASTO,
        fecha=suscripcion.fecha_proximo_pago,
        notas=f"Pago de suscripción: {suscripcion.nombre}",
        cuenta_id=datos.cuenta_id,
        categoria_id=datos.categoria_id,
    )
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
