"""Lógica de negocio de las deudas: préstamos que haces o te hacen, y sus abonos."""

from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlmodel import Session, col, select

from app.models import AbonoDeuda, Cuenta, Deuda, Moneda, SentidoDeuda
from app.schemas import AbonoDeudaCreate, AbonoDeudaRead, DeudaCreate, DeudaRead, DeudaUpdate
from app.services import configuracion
from app.services.comun import cambios_parciales, guardar, obtener_o_404, obtener_referencia
from app.services.errores import ConflictoError, ReglaDeNegocioError
from app.services.saldos import a_decimal

_ANULABLES = frozenset({"fecha_vencimiento", "cuenta_id", "notas"})


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------
def _abonos_por_deuda(session: Session, ids: list[int]) -> dict[int, list[AbonoDeuda]]:
    """Todos los abonos de esas deudas en una sola consulta (no una por deuda)."""
    abonos: defaultdict[int, list[AbonoDeuda]] = defaultdict(list)
    consulta = select(AbonoDeuda).where(col(AbonoDeuda.deuda_id).in_(ids)).order_by(col(AbonoDeuda.fecha))
    for abono in session.exec(consulta).all():
        abonos[abono.deuda_id].append(abono)
    return abonos


def _a_lectura(deuda: Deuda, abonos: list[AbonoDeuda], hoy: date) -> DeudaRead:
    abonado = sum((a_decimal(a.monto) for a in abonos), Decimal("0.00"))
    pendiente = a_decimal(deuda.monto) - abonado
    vencida = pendiente > 0 and deuda.fecha_vencimiento is not None and deuda.fecha_vencimiento < hoy
    return DeudaRead.model_validate(
        deuda,
        update={
            "abonado": abonado,
            "pendiente": pendiente,
            "vencida": vencida,
            "abonos": [AbonoDeudaRead.model_validate(a) for a in abonos],
        },
    )


def listar(
    session: Session,
    sentido: SentidoDeuda | None = None,
    pendientes: bool | None = None,
    hoy: date | None = None,
) -> list[DeudaRead]:
    """Pendientes primero (las que vencen antes arriba); después, las saldadas más recientes."""
    hoy = hoy or date.today()
    consulta = select(Deuda)
    if sentido is not None:
        consulta = consulta.where(Deuda.sentido == sentido)
    if pendientes is not None:
        saldada = col(Deuda.fecha_saldada)
        consulta = consulta.where(saldada.is_(None) if pendientes else saldada.is_not(None))
    deudas = session.exec(consulta).all()
    abonos = _abonos_por_deuda(session, [d.id for d in deudas])
    lecturas = [_a_lectura(d, abonos[d.id], hoy) for d in deudas]
    return sorted(
        lecturas,
        key=lambda d: (
            d.fecha_saldada is not None,
            d.fecha_vencimiento or date.max,
            -(d.fecha_saldada or d.fecha).toordinal(),
        ),
    )


def _obtener(session: Session, deuda_id: int) -> Deuda:
    return obtener_o_404(session, Deuda, deuda_id, "la deuda")


def obtener(session: Session, deuda_id: int, hoy: date | None = None) -> DeudaRead:
    deuda = _obtener(session, deuda_id)
    return _a_lectura(deuda, _abonos_por_deuda(session, [deuda_id])[deuda_id], hoy or date.today())


# ---------------------------------------------------------------------------
# Escritura
# ---------------------------------------------------------------------------
def _comprobar_cuenta(session: Session, cuenta_id: int | None, moneda: Moneda) -> None:
    """La cuenta debe existir y estar en la moneda de la deuda: así su saldo no mezcla divisas."""
    if cuenta_id is None:
        return
    cuenta = obtener_referencia(session, Cuenta, cuenta_id, "la cuenta")
    if cuenta.moneda != moneda:
        raise ReglaDeNegocioError(
            f"La cuenta '{cuenta.nombre}' está en {cuenta.moneda.value} y la deuda en "
            f"{moneda.value}: deben coincidir"
        )


def _abonado(session: Session, deuda_id: int) -> Decimal:
    montos = session.exec(select(AbonoDeuda.monto).where(AbonoDeuda.deuda_id == deuda_id)).all()
    return sum((a_decimal(m) for m in montos), Decimal("0.00"))


def _actualizar_saldada(session: Session, deuda: Deuda) -> None:
    """Anota (o quita) el día en que la deuda quedó a cero: el de su último abono."""
    if _abonado(session, deuda.id) < a_decimal(deuda.monto):
        deuda.fecha_saldada = None
        return
    ultima = session.exec(
        select(AbonoDeuda.fecha)
        .where(AbonoDeuda.deuda_id == deuda.id)
        .order_by(col(AbonoDeuda.fecha).desc())
        .limit(1)
    ).first()
    deuda.fecha_saldada = ultima or deuda.fecha


def crear(session: Session, datos: DeudaCreate) -> DeudaRead:
    deuda = Deuda.model_validate(datos)
    if deuda.moneda is None:
        cuenta = session.get(Cuenta, deuda.cuenta_id) if deuda.cuenta_id is not None else None
        deuda.moneda = cuenta.moneda if cuenta else configuracion.moneda_principal(session)
    configuracion.comprobar_moneda_activa(session, deuda.moneda)
    _comprobar_cuenta(session, deuda.cuenta_id, deuda.moneda)
    guardar(session, deuda)
    return obtener(session, deuda.id)


def actualizar(session: Session, deuda_id: int, cambios: DeudaUpdate) -> DeudaRead:
    deuda = _obtener(session, deuda_id)
    datos = cambios_parciales(cambios, anulables=_ANULABLES)
    # Validamos el estado final completo antes de tocar la deuda.
    final = deuda.model_copy(update=datos)
    abonado = _abonado(session, deuda_id)
    if final.moneda != deuda.moneda:
        if abonado > 0:
            raise ConflictoError("No se puede cambiar la moneda de una deuda que ya tiene abonos")
        configuracion.comprobar_moneda_activa(session, final.moneda)
    if a_decimal(final.monto) < abonado:
        raise ReglaDeNegocioError(f"Ya se abonaron {abonado}: el importe no puede ser menor")
    _comprobar_cuenta(session, final.cuenta_id, final.moneda)
    deuda.sqlmodel_update(datos)
    _actualizar_saldada(session, deuda)
    guardar(session, deuda)
    return obtener(session, deuda_id)


def eliminar(session: Session, deuda_id: int) -> None:
    """Borra la deuda con sus abonos: los saldos de las cuentas vuelven a como estaban."""
    deuda = _obtener(session, deuda_id)
    for abono in session.exec(select(AbonoDeuda).where(AbonoDeuda.deuda_id == deuda_id)).all():
        session.delete(abono)
    session.delete(deuda)
    session.commit()


def abonar(session: Session, deuda_id: int, datos: AbonoDeudaCreate) -> DeudaRead:
    """Registra una devolución. No puede pasar de lo pendiente."""
    deuda = _obtener(session, deuda_id)
    pendiente = a_decimal(deuda.monto) - _abonado(session, deuda_id)
    if pendiente <= 0:
        raise ConflictoError("Esta deuda ya está saldada")
    if datos.monto > pendiente:
        raise ReglaDeNegocioError(f"Solo quedan {pendiente} {deuda.moneda.value} pendientes")
    _comprobar_cuenta(session, datos.cuenta_id, deuda.moneda)
    session.add(AbonoDeuda.model_validate(datos, update={"deuda_id": deuda_id}))
    session.flush()  # para que _actualizar_saldada vea el abono nuevo
    _actualizar_saldada(session, deuda)
    guardar(session, deuda)
    return obtener(session, deuda_id)


def eliminar_abono(session: Session, deuda_id: int, abono_id: int) -> DeudaRead:
    deuda = _obtener(session, deuda_id)
    abono = obtener_o_404(session, AbonoDeuda, abono_id, "el abono")
    if abono.deuda_id != deuda_id:
        raise ReglaDeNegocioError("Ese abono es de otra deuda")
    session.delete(abono)
    session.flush()
    _actualizar_saldada(session, deuda)
    guardar(session, deuda)
    return obtener(session, deuda_id)
