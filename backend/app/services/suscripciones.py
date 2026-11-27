"""Lógica de negocio de las suscripciones y gastos recurrentes."""

from datetime import date, timedelta

from sqlmodel import Session, col, or_, select

from app.models import Suscripcion, TipoMovimiento, Transaccion
from app.schemas import PagoSuscripcionCreate, SuscripcionCreate, SuscripcionUpdate
from app.services import configuracion
from app.services.comun import cambios_parciales, guardar, obtener_o_404
from app.services.errores import ReglaDeNegocioError
from app.services.periodicidad import (
    CAMPOS_CALENDARIO,
    calendario_de,
    comprobar_fecha_prevista,
    siguiente_fecha,
    validar_calendario,
)
from app.services.transacciones import completar_montos, validar_relaciones

# La cuenta y la categoría por defecto se pueden quitar (null = se eligen al pagar).
_ANULABLES = CAMPOS_CALENDARIO | {"cuenta_id", "categoria_id"}


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


def _validar(session: Session, suscripcion: Suscripcion) -> None:
    """Calendario coherente y, si las hay, cuenta y categoría (de gasto) que existan."""
    validar_calendario(suscripcion)
    if suscripcion.cuenta_id is not None or suscripcion.categoria_id is not None:
        if suscripcion.cuenta_id is None or suscripcion.categoria_id is None:
            raise ReglaDeNegocioError("Indica la cuenta y la categoría del pago, o ninguna de las dos")
        validar_relaciones(session, suscripcion.cuenta_id, suscripcion.categoria_id, TipoMovimiento.GASTO)


def crear(session: Session, datos: SuscripcionCreate) -> Suscripcion:
    suscripcion = Suscripcion.model_validate(datos)
    _validar(session, suscripcion)
    suscripcion.moneda = suscripcion.moneda or configuracion.moneda_principal(session)
    configuracion.comprobar_moneda_activa(session, suscripcion.moneda)
    return guardar(session, suscripcion)


def actualizar(session: Session, suscripcion_id: int, cambios: SuscripcionUpdate) -> Suscripcion:
    suscripcion = obtener(session, suscripcion_id)
    datos = cambios_parciales(cambios, anulables=_ANULABLES)
    if "moneda" in datos:
        configuracion.comprobar_moneda_activa(session, datos["moneda"])
    # Se valida el estado final antes de tocar el objeto, para no dejarlo a medio cambiar.
    _validar(session, suscripcion.model_copy(update=datos))
    suscripcion.sqlmodel_update(datos)
    return guardar(session, suscripcion)


def olvidar_pago_por_defecto(session: Session, cuenta_id: int | None = None, categoria_id: int | None = None) -> None:
    """Al borrar una cuenta o categoría, las suscripciones que la usaban por defecto la pierden
    (las dos a la vez: van juntas). No hace commit: va en la misma operación que el borrado."""
    # Solo lo indicado: comparar con None sería "IS NULL" y tocaría las que no tienen ninguna.
    condiciones = [
        columna == valor
        for columna, valor in ((col(Suscripcion.cuenta_id), cuenta_id), (col(Suscripcion.categoria_id), categoria_id))
        if valor is not None
    ]
    if not condiciones:
        return
    usadas = session.exec(select(Suscripcion).where(or_(*condiciones))).all()
    for suscripcion in usadas:
        suscripcion.cuenta_id = suscripcion.categoria_id = None
        session.add(suscripcion)


def eliminar(session: Session, suscripcion_id: int) -> None:
    # Las transacciones ya creadas por sus cobros se conservan: son historial real.
    session.delete(obtener(session, suscripcion_id))
    session.commit()


def registrar_pago(
    session: Session, suscripcion_id: int, datos: PagoSuscripcionCreate
) -> tuple[Transaccion, Suscripcion]:
    """Anota el cobro como gasto y mueve la suscripción a su siguiente fecha."""
    suscripcion = obtener(session, suscripcion_id)
    comprobar_fecha_prevista(datos.fecha_prevista, suscripcion.fecha_proximo_pago, "pago")
    # Lo que se elija al pagar manda; si no, lo guardado en la suscripción (pago de un clic).
    cuenta_id = datos.cuenta_id or suscripcion.cuenta_id
    categoria_id = datos.categoria_id or suscripcion.categoria_id
    if cuenta_id is None or categoria_id is None:
        raise ReglaDeNegocioError("Indica la cuenta de cargo y la categoría del pago")
    cuenta = validar_relaciones(session, cuenta_id, categoria_id, TipoMovimiento.GASTO)

    transaccion = Transaccion(
        monto=suscripcion.monto,
        moneda=suscripcion.moneda,
        tipo=TipoMovimiento.GASTO,
        fecha=suscripcion.fecha_proximo_pago,
        notas=f"Pago de suscripción: {suscripcion.nombre}",
        cuenta_id=cuenta_id,
        categoria_id=categoria_id,
        suscripcion_id=suscripcion.id,
    )
    # Con la tasa del día del cobro: p. ej. Netflix en USD pagado con una cuenta en MXN.
    completar_montos(session, transaccion, cuenta)
    # Con su calendario (p. ej. "los días 5, 15 y 30" o "adelantar al viernes").
    suscripcion.fecha_proximo_pago = siguiente_fecha(
        suscripcion.fecha_proximo_pago, suscripcion.periodicidad, calendario_de(suscripcion)
    )

    # Un único commit para ambos cambios: o se guardan los dos o ninguno.
    session.add(transaccion)
    session.add(suscripcion)
    session.commit()
    session.refresh(transaccion)
    session.refresh(suscripcion)
    return transaccion, suscripcion
