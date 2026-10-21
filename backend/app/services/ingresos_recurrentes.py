"""Lógica de negocio de los ingresos recurrentes (nómina, rentas, envíos...)."""

from datetime import date, timedelta

from sqlmodel import Session, col, select

from app.models import Cuenta, IngresoRecurrente, IngresoRecurrenteBase, TipoMovimiento, Transaccion
from app.schemas import CobroIngresoCreate, IngresoRecurrenteCreate, IngresoRecurrenteUpdate
from app.services import configuracion
from app.services.comun import cambios_parciales, guardar, obtener_o_404
from app.services.errores import ReglaDeNegocioError
from app.services.periodicidad import DIA_QUINCENA, ULTIMO_DIA, Calendario, siguiente_fecha

# Ajustes del calendario: un null explícito vuelve al comportamiento clásico.
_CAMPOS_CALENDARIO = frozenset(
    {"intervalo", "dia_quincena_1", "dia_quincena_2", "dia_del_mes", "adelantar_a_habil"}
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


def _validar_calendario(ingreso: IngresoRecurrenteBase) -> None:
    """Los dos días de la quincena, si se eligen, van juntos y en orden."""
    dias = (ingreso.dia_quincena_1, ingreso.dia_quincena_2)
    if dias.count(None) == 1:
        raise ReglaDeNegocioError("Indica los dos días de cobro de la quincena")
    if None not in dias and dias[0] >= dias[1]:
        raise ReglaDeNegocioError("El primer día de la quincena debe ser anterior al segundo")


def _calendario(ingreso: IngresoRecurrenteBase) -> Calendario:
    return Calendario(
        intervalo=ingreso.intervalo or 1,
        dias_quincena=(ingreso.dia_quincena_1 or DIA_QUINCENA, ingreso.dia_quincena_2 or ULTIMO_DIA),
        dia_del_mes=ingreso.dia_del_mes,
        adelantar_a_habil=bool(ingreso.adelantar_a_habil),
    )


def crear(session: Session, datos: IngresoRecurrenteCreate) -> IngresoRecurrente:
    ingreso = IngresoRecurrente.model_validate(datos)
    _validar_calendario(ingreso)
    # Lo normal es cobrar en la divisa de la cuenta (p. ej. la nómina en MXN en un banco en MXN).
    ingreso.moneda = ingreso.moneda or _validar(session, ingreso).moneda
    return guardar(session, ingreso)


def actualizar(session: Session, ingreso_id: int, cambios: IngresoRecurrenteUpdate) -> IngresoRecurrente:
    ingreso = obtener(session, ingreso_id)
    datos = cambios_parciales(cambios, anulables=_CAMPOS_CALENDARIO)
    # Validamos el estado final completo (p. ej. una cuenta nueva con la categoría
    # de antes) antes de tocar el objeto, para no dejarlo a medio cambiar si falla.
    if datos.keys() & {"cuenta_id", "categoria_id", "moneda"}:
        _validar(session, ingreso.model_copy(update=datos))
    if datos.keys() & {"dia_quincena_1", "dia_quincena_2"}:
        _validar_calendario(ingreso.model_copy(update=datos))
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


def omitir_cobro(session: Session, ingreso_id: int) -> IngresoRecurrente:
    """Salta un periodo sin anotar nada (p. ej. un mes en que no hubo pago)."""
    ingreso = obtener(session, ingreso_id)
    _avanzar(ingreso)
    return guardar(session, ingreso)


def _avanzar(ingreso: IngresoRecurrenteBase) -> None:
    # Se avanza desde la fecha prevista, no desde la real: si la nómina del 15
    # llegó el 16, la siguiente sigue siendo el último día del mes.
    ingreso.fecha_proximo_cobro = siguiente_fecha(
        ingreso.fecha_proximo_cobro, ingreso.periodicidad, _calendario(ingreso)
    )
