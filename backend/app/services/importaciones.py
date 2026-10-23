"""Importar movimientos de un extracto bancario a una cuenta.

Dos pasos, para que nada se guarde sin que el usuario lo vea:
1. `vista_previa`: lee el archivo, deduce el tipo y la categoría de cada
   movimiento y marca los que ya estaban registrados. No guarda nada.
2. `confirmar`: crea de golpe las transacciones que el usuario aceptó.

La categoría se aprende del historial: si "MERCADONA" ya se anotó como
Supermercado, la próxima vez se sugiere sola. Así, cuanto más se usa, menos
hay que corregir.

El dinero que pasa entre cuentas propias ("To MXN" en Revolut) no es ingreso ni
gasto: se propone como transferencia con la otra cuenta (ver `_cuenta_de_transferencia`).
"""

import re
from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlmodel import Session, col, select

from app.database import normalizar_texto
from app.datos_iniciales import CATEGORIA_OTROS_GASTOS, CATEGORIA_OTROS_INGRESOS
from app.models import Cuenta, Moneda, TipoMovimiento, Transaccion, Transferencia
from app.schemas import (
    FilaImportacion,
    ImportacionCreate,
    MovimientoImportado,
    ResultadoImportacion,
    VistaPreviaImportacion,
)
from app.services import categorias, divisas, transacciones
from app.services.comun import obtener_referencia
from app.services.errores import ReglaDeNegocioError
from app.services.lector_extractos import MovimientoLeido, leer_extracto

# Palabras que los bancos añaden a casi todos los conceptos y no dicen nada del comercio.
_RUIDO = frozenset({
    "compra", "compras", "tarj", "tarjeta", "pago", "pagos", "recibo", "cargo", "abono", "en", "de",
    "del", "la", "el", "con", "por", "ref", "num", "op", "contactless", "transaccion",
})
# Un movimiento anotado a mano suele llevar la fecha de la compra y el banco la del
# cargo, uno o dos días después: dentro de este margen se considera el mismo.
MARGEN_DUPLICADOS = timedelta(days=2)
# Cambio de divisa entre cuentas propias: "To MXN", "From EUR", "Exchanged to USD"…
_PATRON_TRANSFERENCIA = re.compile(r"^(?:exchanged\s+)?(?:to|from)\s+([a-z]{3})$", re.IGNORECASE)


def clave_concepto(concepto: str | None) -> str:
    """Lo que identifica al comercio: "COMPRA TARJ. 1234 MERCADONA 02/10" → "mercadona".

    Sin números (tarjetas, fechas, referencias), tildes ni palabras de relleno.
    """
    texto = normalizar_texto(concepto) or ""
    return " ".join(p for p in re.findall(r"[a-z]+", texto) if len(p) > 1 and p not in _RUIDO)


# ---------------------------------------------------------------------------
# Categoría sugerida a partir del historial
# ---------------------------------------------------------------------------
class _Historial:
    """Qué categoría se usó para cada concepto, por tipo de movimiento."""

    def __init__(self, session: Session) -> None:
        self.exactas: dict[tuple[TipoMovimiento, str], int] = {}
        self.por_comercio: dict[tuple[TipoMovimiento, str], Counter[int]] = defaultdict(Counter)
        consulta = (
            select(Transaccion.notas, Transaccion.tipo, Transaccion.categoria_id)
            .where(col(Transaccion.notas).is_not(None), col(Transaccion.transferencia_id).is_(None))
            .order_by(col(Transaccion.fecha), col(Transaccion.id))
        )
        for notas, tipo, categoria_id in session.exec(consulta).all():
            clave = clave_concepto(notas)
            if clave:
                self.exactas[(tipo, clave)] = categoria_id  # en orden: gana la más reciente
                self.por_comercio[(tipo, clave.split()[0])][categoria_id] += 1

    def sugerir(self, tipo: TipoMovimiento, concepto: str) -> tuple[int | None, str]:
        clave = clave_concepto(concepto)
        if not clave:
            return None, "ninguna"
        if (tipo, clave) in self.exactas:
            return self.exactas[(tipo, clave)], "alta"
        # Mismo comercio con otros detalles ("MERCADONA MADRID" frente a "MERCADONA VALENCIA").
        comercio = clave.split()[0]
        if len(comercio) >= 3 and self.por_comercio.get((tipo, comercio)):
            return self.por_comercio[(tipo, comercio)].most_common(1)[0][0], "media"
        return None, "ninguna"


# ---------------------------------------------------------------------------
# Duplicados: lo que ya está registrado en la cuenta
# ---------------------------------------------------------------------------
def _ya_registrados(session: Session, cuenta: Cuenta, desde: date, hasta: date) -> list[tuple[date, Decimal]]:
    """Movimientos de la cuenta en el periodo, con signo y en su moneda (como en el extracto)."""
    desde, hasta = desde - MARGEN_DUPLICADOS, hasta + MARGEN_DUPLICADOS
    registrados: list[tuple[date, Decimal]] = []
    for t in session.exec(
        select(Transaccion).where(Transaccion.cuenta_id == cuenta.id, Transaccion.fecha >= desde, Transaccion.fecha <= hasta)
    ):
        monto = t.monto_cuenta or Decimal(0)
        registrados.append((t.fecha, monto if t.tipo == TipoMovimiento.INGRESO else -monto))
    for tr in session.exec(
        select(Transferencia).where(Transferencia.fecha >= desde, Transferencia.fecha <= hasta)
    ):
        if tr.cuenta_origen_id == cuenta.id:
            registrados.append((tr.fecha, -tr.monto_origen))
        if tr.cuenta_destino_id == cuenta.id:
            registrados.append((tr.fecha, tr.monto_destino or tr.monto_origen))
    return registrados


def _marcar_duplicados(movimientos: list[MovimientoLeido], registrados: list[tuple[date, Decimal]]) -> set[int]:
    """Índices de los movimientos del archivo que ya existen.

    Cada registro solo "tapa" a un movimiento: si el archivo trae dos cafés
    iguales el mismo día y solo hay uno anotado, el otro es nuevo. Primero se
    emparejan las fechas exactas y después las cercanas, para que una
    coincidencia aproximada no le quite su pareja a una exacta.
    """
    libres: dict[Decimal, list[date]] = defaultdict(list)
    for fecha, importe in registrados:
        libres[importe].append(fecha)
    duplicados: set[int] = set()
    for margen in (timedelta(0), MARGEN_DUPLICADOS):
        for indice, movimiento in enumerate(movimientos):
            if indice in duplicados:
                continue
            candidatas = libres.get(movimiento.importe, [])
            pareja = next((f for f in candidatas if abs(f - movimiento.fecha) <= margen), None)
            if pareja is not None:
                candidatas.remove(pareja)
                duplicados.add(indice)
    return duplicados


# ---------------------------------------------------------------------------
# Transferencias entre cuentas propias
# ---------------------------------------------------------------------------
def _palabras(nombre: str) -> set[str]:
    return set(re.findall(r"[a-z]+", normalizar_texto(nombre) or ""))


def _cuenta_de_transferencia(concepto: str, cuenta: Cuenta, otras: list[Cuenta]) -> tuple[int | None, bool]:
    """(otra cuenta, segura) si el concepto es un cambio de divisa entre cuentas propias.

    "To MXN" sale de la cuenta en otra moneda y llega a la de pesos: la otra cuenta es
    la de esa moneda o, si el movimiento está en la de pesos, una en otra moneda. Se
    prefiere la del mismo banco (subcuenta o con una palabra del nombre en común, como
    "Revolut"). Es segura si solo hay una candidata así.
    """
    encontrado = _PATRON_TRANSFERENCIA.match(concepto.strip())
    if not encontrado:
        return None, False
    codigo = encontrado.group(1).upper()
    if codigo not in {m.value for m in Moneda}:
        return None, False
    if codigo != cuenta.moneda:
        candidatas = [c for c in otras if c.moneda == codigo]
    else:
        candidatas = [c for c in otras if c.moneda != cuenta.moneda]
    familia = {cuenta.id, cuenta.cuenta_padre_id} - {None}
    mismo_banco = [
        c for c in candidatas
        if c.id in familia or c.cuenta_padre_id in familia or _palabras(c.nombre) & _palabras(cuenta.nombre)
    ]
    elegidas = mismo_banco or candidatas
    return (elegidas[0].id if elegidas else None), len(elegidas) == 1


def _como_transferencia(session: Session, cuenta: Cuenta, otra: Cuenta, movimiento: MovimientoImportado) -> Transferencia:
    """La transferencia que representa un movimiento del extracto con otra cuenta propia.

    Del extracto solo se conoce el lado de esta cuenta; el de la otra se estima con la
    tasa de esa fecha (y por eso no cuenta en el coste de los envíos).
    """
    sale = movimiento.tipo == TipoMovimiento.GASTO
    origen, destino = (cuenta, otra) if sale else (otra, cuenta)
    otro_lado = divisas.convertir(session, movimiento.monto, cuenta.moneda, otra.moneda, movimiento.fecha)
    return Transferencia(
        cuenta_origen_id=origen.id, cuenta_destino_id=destino.id,
        monto_origen=movimiento.monto if sale else otro_lado,
        monto_destino=otro_lado if sale else movimiento.monto,
        fecha=movimiento.fecha, notas=movimiento.concepto or None,
        destino_estimado=None if cuenta.moneda == otra.moneda else True,
    )


# ---------------------------------------------------------------------------
# Los dos pasos
# ---------------------------------------------------------------------------
def vista_previa(
    session: Session, cuenta_id: int, contenido: bytes, invertir_signos: bool | None = None
) -> VistaPreviaImportacion:
    """Lo que se importaría, sin guardar nada.

    `invertir_signos` es para las tarjetas que exportan las compras en positivo. Sin
    indicarlo, se usa lo que se eligió la última vez en esta cuenta.
    """
    cuenta = obtener_referencia(session, Cuenta, cuenta_id, "la cuenta")
    if invertir_signos is None:
        invertir_signos = bool(cuenta.importar_invertido)
    extracto = leer_extracto(contenido)
    movimientos = extracto.movimientos
    if invertir_signos:
        movimientos = [MovimientoLeido(m.fila, m.fecha, -m.importe, m.concepto) for m in movimientos]

    fechas = [m.fecha for m in movimientos]
    duplicados = _marcar_duplicados(movimientos, _ya_registrados(session, cuenta, min(fechas), max(fechas)))
    historial = _Historial(session)
    otros = {
        TipoMovimiento.GASTO: categorias.de_la_app(session, CATEGORIA_OTROS_GASTOS, TipoMovimiento.GASTO).id,
        TipoMovimiento.INGRESO: categorias.de_la_app(session, CATEGORIA_OTROS_INGRESOS, TipoMovimiento.INGRESO).id,
    }
    session.commit()  # por si hubo que volver a crear "Otros gastos" u "Otros ingresos"
    otras_cuentas = list(session.exec(select(Cuenta).where(Cuenta.id != cuenta.id).order_by(col(Cuenta.id))))

    filas = []
    for indice, m in enumerate(movimientos):
        tipo = TipoMovimiento.INGRESO if m.importe > 0 else TipoMovimiento.GASTO
        categoria_id, confianza = historial.sugerir(tipo, m.concepto)
        otra, segura = _cuenta_de_transferencia(m.concepto, cuenta, otras_cuentas)
        if otra is not None:
            confianza = "alta" if segura else "media"
        filas.append(FilaImportacion(
            fila=m.fila, fecha=m.fecha, monto=abs(m.importe), tipo=tipo, concepto=m.concepto,
            categoria_id=categoria_id or otros[tipo], confianza=confianza, duplicado=indice in duplicados,
            cuenta_transferencia_id=otra,
        ))
    return VistaPreviaImportacion(
        columnas=extracto.columnas, filas=filas, filas_ignoradas=extracto.filas_ignoradas,
        invertir_signos=invertir_signos,
    )


def confirmar(session: Session, datos: ImportacionCreate) -> ResultadoImportacion:
    """Crea todas las transacciones (y transferencias) o ninguna: nada queda a medias."""
    cuenta = obtener_referencia(session, Cuenta, datos.cuenta_id, "la cuenta")
    # Un extracto suele cubrir meses atrás: una sola descarga para todo el periodo,
    # en vez de una por movimiento, y cada uno se convierte con la tasa de su día.
    fechas = [m.fecha for m in datos.movimientos]
    divisas.asegurar_tasas_historicas(session, min(fechas), max(fechas))
    nuevas: list[Transaccion | Transferencia] = []
    for movimiento in datos.movimientos:
        if movimiento.cuenta_transferencia_id is not None:
            otra = obtener_referencia(session, Cuenta, movimiento.cuenta_transferencia_id, "la otra cuenta")
            if otra.id == cuenta.id:
                raise ReglaDeNegocioError("Una transferencia necesita otra cuenta distinta")
            nuevas.append(_como_transferencia(session, cuenta, otra, movimiento))
            continue
        transacciones.validar_relaciones(session, cuenta.id, movimiento.categoria_id, movimiento.tipo)
        transaccion = Transaccion(
            monto=movimiento.monto, tipo=movimiento.tipo, fecha=movimiento.fecha,
            notas=movimiento.concepto or None, categoria_id=movimiento.categoria_id, cuenta_id=cuenta.id,
        )
        # Igual que una transacción escrita a mano: en la moneda de la cuenta y convertida a la principal.
        transacciones.completar_montos(session, transaccion, cuenta)
        nuevas.append(transaccion)
    if datos.invertir_signos is not None:
        cuenta.importar_invertido = datos.invertir_signos
        session.add(cuenta)
    session.add_all(nuevas)
    session.commit()
    return ResultadoImportacion(
        creadas=len(nuevas), transferencias=sum(isinstance(n, Transferencia) for n in nuevas)
    )
