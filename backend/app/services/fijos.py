"""Reconocer un cobro o pago fijo en un movimiento anotado a mano o importado.

El Plan del mes cuenta como previsto cada fecha de un fijo que no se registró, y esa fecha
solo avanzaba con "Cobrar"/"Pagar" en Pagos fijos. Si la nómina se anotaba a mano o llegaba
en un extracto, contaba dos veces: real + prevista. Aquí se buscan los fijos que se parecen
a un movimiento (mismo tipo, fecha e importe cercanos) para proponer vincularlos.

Un ingreso se compara con los ingresos recurrentes y un gasto con los pagos fijos
(suscripciones): nunca se cruzan.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from sqlmodel import Session, select

from app.models import Cuenta, IngresoRecurrente, Moneda, Suscripcion, TipoMovimiento, Transaccion
from app.schemas import FijoCandidato
from app.services import configuracion, divisas
from app.services.comun import obtener_referencia
from app.services.errores import ConflictoError, ReglaDeNegocioError

# La nómina no siempre llega el día exacto (fin de semana, festivo, el banco tarda) y un cargo
# puede adelantarse o anotarse tarde: una semana a cada lado cubre eso sin confundir un fijo
# mensual con el del mes siguiente. Incluye los atrasados que caen dentro del margen.
MARGEN_FECHA_FIJO = timedelta(days=7)
# Un fijo cambia un poco de un mes a otro (horas extra, IVA, la tasa de cambio del banco):
# hasta un 10 % de diferencia sigue siendo "el mismo" cobro o pago.
TOLERANCIA_IMPORTE_FIJO = Decimal("0.10")

# Cuánto se parece: menor es mejor. (cuenta, días de diferencia, diferencia relativa de importe).
Parecido = tuple[int, int, Decimal]


@dataclass(frozen=True)
class _Fijo:
    id: int
    tipo: TipoMovimiento
    nombre: str
    monto: Decimal
    moneda: Moneda
    fecha: date
    cuenta_id: int | None

    def a_candidato(self) -> FijoCandidato:
        return FijoCandidato(
            id=self.id, tipo=self.tipo, nombre=self.nombre, monto=self.monto, moneda=self.moneda,
            fecha_prevista=self.fecha, cuenta_id=self.cuenta_id,
        )


class Fijos:
    """Los fijos cargados una sola vez: un extracto con miles de filas no hace mil consultas."""

    def __init__(self, session: Session) -> None:
        self.session = session
        principal = configuracion.moneda_principal(session)
        self.fijos = [
            _Fijo(i.id, TipoMovimiento.INGRESO, i.nombre, i.monto, i.moneda or principal, i.fecha_proximo_cobro, i.cuenta_id)
            for i in session.exec(select(IngresoRecurrente)).all()
            if i.id is not None
        ] + [
            _Fijo(s.id, TipoMovimiento.GASTO, s.nombre, s.monto, s.moneda or principal, s.fecha_proximo_pago, s.cuenta_id)
            for s in session.exec(select(Suscripcion)).all()
            if s.id is not None
        ]

    def _diferencia_importe(self, fijo: _Fijo, monto: Decimal, moneda: Moneda, fecha: date) -> Decimal | None:
        """Diferencia relativa entre el movimiento y el fijo, comparados en la moneda del fijo."""
        try:
            # Con la tasa del día del movimiento: es lo que el banco aplicó.
            en_moneda_fijo = divisas.convertir_sin_redondeo(self.session, monto, moneda, fijo.moneda, fecha)
        except ReglaDeNegocioError:
            return None  # sin tasa no se puede comparar: mejor no sugerir que adivinar
        return abs(en_moneda_fijo - fijo.monto) / fijo.monto

    def candidatos(
        self, tipo: TipoMovimiento, monto: Decimal, moneda: Moneda, cuenta_id: int, fecha: date
    ) -> list[tuple[Parecido, FijoCandidato]]:
        """Los fijos que se parecen al movimiento, del más parecido al menos."""
        encontrados: list[tuple[Parecido, int, FijoCandidato]] = []
        for fijo in self.fijos:
            dias = abs((fijo.fecha - fecha).days)
            if fijo.tipo != tipo or dias > MARGEN_FECHA_FIJO.days:
                continue
            diferencia = self._diferencia_importe(fijo, monto, moneda, fecha)
            if diferencia is None or diferencia > TOLERANCIA_IMPORTE_FIJO:
                continue
            # La misma cuenta primero; uno sin cuenta guardada (pago que se elige al pagar) después.
            cuenta = 0 if fijo.cuenta_id == cuenta_id else (1 if fijo.cuenta_id is None else 2)
            encontrados.append(((cuenta, dias, diferencia), fijo.id, fijo.a_candidato()))
        encontrados.sort(key=lambda e: (e[0], e[1]))  # el id solo desempata (orden estable)
        return [(parecido, candidato) for parecido, _, candidato in encontrados]


def candidatos(
    session: Session, tipo: TipoMovimiento, monto: Decimal, cuenta_id: int, fecha: date, moneda: Moneda | None = None
) -> list[FijoCandidato]:
    """Fijos que podrían ser este movimiento. Sin `moneda`, la de la cuenta."""
    cuenta = obtener_referencia(session, Cuenta, cuenta_id, "la cuenta")
    return [c for _, c in Fijos(session).candidatos(tipo, monto, moneda or cuenta.moneda, cuenta_id, fecha)]


def comprobar_reconocible(transaccion: Transaccion, tipo: TipoMovimiento) -> None:
    """Solo un ingreso o gasto normal, aún sin fijo, puede ser el cobro o pago de uno."""
    if transaccion.tipo != tipo:
        que = "un ingreso" if tipo == TipoMovimiento.INGRESO else "un gasto"
        raise ReglaDeNegocioError(f"Ese movimiento no es {que}: no puede ser este fijo")
    if transaccion.transferencia_id is not None:
        raise ReglaDeNegocioError("La comisión de una transferencia no puede ser un fijo")
    if transaccion.suscripcion_id is not None or transaccion.ingreso_recurrente_id is not None:
        raise ConflictoError("Ese movimiento ya está reconocido como un fijo")
