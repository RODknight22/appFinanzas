"""Lógica de negocio de las transferencias entre cuentas.

Una transferencia mueve los saldos de dos cuentas sin ser ingreso ni gasto.
Lo único que sí es gasto es su comisión, que se guarda como una transacción
enlazada (`transferencia_id`) para que aparezca en el dashboard y presupuestos.

Entre monedas, además, se calcula lo que costó el envío frente a la tasa del BCE
de su fecha (ver `coste_envio`).
"""

from datetime import date
from decimal import Decimal

from sqlmodel import Session, col, or_, select

from app.datos_iniciales import CATEGORIA_COMISIONES
from app.models import Cuenta, LadoTransferencia, Moneda, TipoMovimiento, Transaccion, Transferencia
from app.schemas import CosteEnviosAnio, TransferenciaCreate, TransferenciaRead, TransferenciaUpdate
from app.services import categorias, configuracion, divisas
from app.services.comun import cambios_parciales, obtener_o_404, obtener_referencia
from app.services.errores import ReglaDeNegocioError
from app.services.saldos import CENTIMOS
from app.services.transacciones import completar_montos

_PORCENTAJE = Decimal("0.01")

# Si cambia alguno de estos campos, el importe que llega hay que recalcularlo.
_CAMPOS_QUE_AFECTAN_AL_DESTINO = frozenset({"monto_origen", "cuenta_origen_id", "cuenta_destino_id", "fecha"})


def listar(session: Session, *, cuenta_id: int | None = None, offset: int = 0, limit: int = 100) -> list[Transferencia]:
    """Las más recientes primero; con `cuenta_id`, las que salen de o llegan a esa cuenta."""
    consulta = select(Transferencia)
    if cuenta_id is not None:
        consulta = consulta.where(
            or_(Transferencia.cuenta_origen_id == cuenta_id, Transferencia.cuenta_destino_id == cuenta_id)
        )
    consulta = (
        consulta.order_by(col(Transferencia.fecha).desc(), col(Transferencia.id).desc())
        .offset(offset)
        .limit(limit)
    )
    return list(session.exec(consulta).all())


def obtener(session: Session, transferencia_id: int) -> Transferencia:
    return obtener_o_404(session, Transferencia, transferencia_id, "la transferencia")


def _completar_destino(
    session: Session, transferencia: Transferencia, *, destino_indicado: bool
) -> tuple[Cuenta, Cuenta]:
    """Valida las cuentas y rellena `monto_destino` si no se indicó.

    - Misma moneda: llega exactamente lo que sale (la diferencia sería una comisión).
    - Distinta moneda: si no se indica lo que llegó, se estima con la tasa de la fecha
      y se marca como estimado. `destino_indicado` dice si esta petición trae lo que
      llegó de verdad (al editar solo las notas, se conserva lo que hubiera).
    """
    origen = obtener_referencia(session, Cuenta, transferencia.cuenta_origen_id, "la cuenta de origen")
    destino = obtener_referencia(session, Cuenta, transferencia.cuenta_destino_id, "la cuenta de destino")
    if origen.id == destino.id:
        raise ReglaDeNegocioError("La cuenta de origen y la de destino deben ser distintas")

    if origen.moneda == destino.moneda:
        if transferencia.monto_destino not in (None, transferencia.monto_origen):
            raise ReglaDeNegocioError(
                "Entre cuentas de la misma moneda llega lo mismo que sale; anota la diferencia como comisión"
            )
        transferencia.monto_destino = transferencia.monto_origen
        transferencia.destino_estimado = None
        transferencia.lado_estimado = None
        return origen, destino

    # La tasa de esa fecha hace falta para estimar lo que llegó o para calcular el coste.
    divisas.asegurar_tasas_del_dia(session)
    divisas.asegurar_tasas_historicas(session, transferencia.fecha, transferencia.fecha)
    if destino_indicado:
        transferencia.destino_estimado = False
        transferencia.lado_estimado = None
    elif transferencia.monto_destino is None:
        transferencia.monto_destino = divisas.convertir(
            session, transferencia.monto_origen, origen.moneda, destino.moneda, transferencia.fecha
        )
        transferencia.destino_estimado = True
        transferencia.lado_estimado = LadoTransferencia.DESTINO
    return origen, destino


def _comision_de(session: Session, transferencia_id: int | None) -> Transaccion | None:
    consulta = select(Transaccion).where(Transaccion.transferencia_id == transferencia_id)
    return session.exec(consulta).first()


def _sincronizar_comision(session: Session, transferencia: Transferencia, origen: Cuenta, destino: Cuenta) -> None:
    """Crea, actualiza o borra la transacción de gasto que representa la comisión."""
    actual = _comision_de(session, transferencia.id)
    if transferencia.comision is None:
        if actual is not None:
            session.delete(actual)
        return

    comision = actual or Transaccion(
        tipo=TipoMovimiento.GASTO,
        transferencia_id=transferencia.id,
        categoria_id=categorias.de_la_app(session, CATEGORIA_COMISIONES, TipoMovimiento.GASTO).id,
    )
    # La comisión la cobra el banco de origen, en su moneda.
    comision.monto = transferencia.comision
    comision.moneda = origen.moneda
    comision.fecha = transferencia.fecha
    comision.cuenta_id = origen.id
    comision.notas = f"Comisión de la transferencia a {destino.nombre}"
    completar_montos(session, comision, origen)
    session.add(comision)


def _guardar_con_comision(session: Session, transferencia: Transferencia, origen: Cuenta, destino: Cuenta) -> Transferencia:
    """Guarda la transferencia y su comisión en un único commit: o todo o nada."""
    session.add(transferencia)
    session.flush()  # asigna el id, que necesita la comisión para enlazarse
    _sincronizar_comision(session, transferencia, origen, destino)
    session.commit()
    session.refresh(transferencia)
    return transferencia


def crear(session: Session, datos: TransferenciaCreate) -> Transferencia:
    transferencia = Transferencia.model_validate(datos)
    origen, destino = _completar_destino(session, transferencia, destino_indicado=datos.monto_destino is not None)
    return _guardar_con_comision(session, transferencia, origen, destino)


def actualizar(session: Session, transferencia_id: int, cambios: TransferenciaUpdate) -> Transferencia:
    transferencia = obtener(session, transferencia_id)
    datos = cambios_parciales(cambios, anulables=frozenset({"notas", "comision", "monto_destino"}))
    # Si cambia lo que sale (o cuándo, o entre qué cuentas) y no se dice lo que
    # llegó, el importe de destino antiguo ya no vale: se recalcula.
    if "monto_destino" not in datos and datos.keys() & _CAMPOS_QUE_AFECTAN_AL_DESTINO:
        datos["monto_destino"] = None
    transferencia.sqlmodel_update(datos)
    origen, destino = _completar_destino(
        session, transferencia, destino_indicado=datos.get("monto_destino") is not None
    )
    return _guardar_con_comision(session, transferencia, origen, destino)


def eliminar(session: Session, transferencia_id: int) -> None:
    transferencia = obtener(session, transferencia_id)
    comision = _comision_de(session, transferencia.id)
    if comision is not None:
        session.delete(comision)
    session.delete(transferencia)
    session.commit()


# ---------------------------------------------------------------------------
# Coste de los envíos entre monedas
# ---------------------------------------------------------------------------
def coste_envio(
    session: Session, transferencia: Transferencia, de: Moneda, a: Moneda, principal: Moneda
) -> tuple[Decimal, Decimal] | None:
    """(coste, porcentaje) de un envío entre monedas, en la moneda principal.

    Coste = lo que no llegó frente a la tasa del BCE de esa fecha + la comisión.
    Negativo si el banco dio mejor tipo que el de referencia. None si es entre la
    misma moneda o si lo que llegó lo estimó la app (no dice nada del tipo real).
    """
    if de == a or transferencia.destino_estimado or transferencia.monto_destino is None:
        return None
    fecha = transferencia.fecha
    esperado = divisas.convertir_sin_redondeo(session, transferencia.monto_origen, de, a, fecha)
    # Las guardadas antes de existir `destino_estimado` (None) no dicen si lo que llegó
    # era real: si coincide con la tasa del día al céntimo, casi seguro lo estimó la app.
    if transferencia.destino_estimado is None and abs(esperado - transferencia.monto_destino) < CENTIMOS:
        return None
    por_tipo = divisas.convertir_sin_redondeo(session, esperado - transferencia.monto_destino, a, principal, fecha)
    comision = divisas.convertir_sin_redondeo(session, transferencia.comision or Decimal(0), de, principal, fecha)
    enviado = divisas.convertir_sin_redondeo(session, transferencia.monto_origen, de, principal, fecha)
    coste = por_tipo + comision
    return coste.quantize(CENTIMOS), (coste / enviado * 100).quantize(_PORCENTAJE)


def _monedas(session: Session, principal: Moneda) -> dict[int, Moneda]:
    """Moneda de cada cuenta: una consulta en vez de una por transferencia."""
    filas = session.exec(select(Cuenta.id, Cuenta.moneda)).all()
    return {id_: moneda or principal for id_, moneda in filas}


def con_coste(session: Session, transferencias: list[Transferencia]) -> list[TransferenciaRead]:
    """Las transferencias tal cual, más el coste de las que son entre monedas."""
    principal = configuracion.moneda_principal(session)
    monedas = _monedas(session, principal)
    resultado = []
    for transferencia in transferencias:
        leida = TransferenciaRead.model_validate(transferencia)
        coste = coste_envio(
            session, transferencia, monedas[transferencia.cuenta_origen_id],
            monedas[transferencia.cuenta_destino_id], principal,
        )
        if coste is not None:
            leida.coste, leida.coste_porcentaje = coste
        resultado.append(leida)
    return resultado


def coste_del_anio(session: Session, anio: int) -> CosteEnviosAnio:
    """Suma lo que costaron los envíos entre monedas de un año (widget del panel)."""
    principal = configuracion.moneda_principal(session)
    monedas = _monedas(session, principal)
    total = enviado = Decimal(0)
    envios = 0
    consulta = select(Transferencia).where(
        Transferencia.fecha >= date(anio, 1, 1), Transferencia.fecha <= date(anio, 12, 31)
    )
    for transferencia in session.exec(consulta).all():
        de, a = monedas[transferencia.cuenta_origen_id], monedas[transferencia.cuenta_destino_id]
        coste = coste_envio(session, transferencia, de, a, principal)
        if coste is None:
            continue
        total += coste[0]
        enviado += divisas.convertir_sin_redondeo(session, transferencia.monto_origen, de, principal, transferencia.fecha)
        envios += 1
    return CosteEnviosAnio(
        anio=anio, moneda=principal, total=total.quantize(CENTIMOS), envios=envios,
        porcentaje_medio=(total / enviado * 100).quantize(_PORCENTAJE) if enviado else None,
    )
