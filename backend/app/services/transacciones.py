"""Lógica de negocio de las transacciones."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import Select, func
from sqlmodel import Session, col, or_, select

from app.database import normalizar_texto
from app.models import Categoria, Cuenta, TipoMovimiento, Transaccion
from app.schemas import PaginaTransacciones, TransaccionCreate, TransaccionUpdate
from app.services import configuracion, divisas
from app.services.comun import cambios_parciales, guardar, obtener_o_404, obtener_referencia
from app.services.errores import ConflictoError, ReglaDeNegocioError
from app.services.saldos import a_decimal


@dataclass(frozen=True)
class FiltrosTransacciones:
    """Criterios de búsqueda; los que valen None no filtran."""

    desde: date | None = None
    hasta: date | None = None
    tipo: TipoMovimiento | None = None
    cuenta_id: int | None = None
    categoria_id: int | None = None
    # Busca en las notas y en el nombre de la categoría, sin importar mayúsculas ni tildes.
    texto: str | None = None
    # Sobre el importe tal como se escribió (en su moneda), para encontrar "el de 399".
    monto_min: Decimal | None = None
    monto_max: Decimal | None = None


def _filtrar(consulta: Select, filtros: FiltrosTransacciones) -> Select:
    """Añade a `consulta` un WHERE por cada filtro indicado."""
    condiciones = []
    if filtros.desde is not None:
        condiciones.append(Transaccion.fecha >= filtros.desde)
    if filtros.hasta is not None:
        condiciones.append(Transaccion.fecha <= filtros.hasta)
    if filtros.tipo is not None:
        condiciones.append(Transaccion.tipo == filtros.tipo)
    if filtros.cuenta_id is not None:
        condiciones.append(Transaccion.cuenta_id == filtros.cuenta_id)
    if filtros.categoria_id is not None:
        condiciones.append(Transaccion.categoria_id == filtros.categoria_id)
    if filtros.monto_min is not None:
        condiciones.append(Transaccion.monto >= filtros.monto_min)
    if filtros.monto_max is not None:
        condiciones.append(Transaccion.monto <= filtros.monto_max)
    texto = normalizar_texto((filtros.texto or "").strip())
    if texto:
        # % y _ son comodines en LIKE: los escapamos para que "50%" busque "50%" literal.
        escapado = texto.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
        patron = f"%{escapado}%"
        # La categoría se consulta con una subconsulta para no tener que hacer JOIN.
        categorias = select(Categoria.id).where(func.sin_acentos(Categoria.nombre).like(patron, escape="\\"))
        condiciones.append(
            or_(func.sin_acentos(Transaccion.notas).like(patron, escape="\\"), col(Transaccion.categoria_id).in_(categorias))
        )
    return consulta.where(*condiciones)


def listar(session: Session, filtros: FiltrosTransacciones, *, offset: int = 0, limit: int = 100) -> list[Transaccion]:
    """Transacciones que cumplen los filtros, las más recientes primero."""
    consulta = (
        _filtrar(select(Transaccion), filtros)
        .order_by(col(Transaccion.fecha).desc(), col(Transaccion.id).desc())
        .offset(offset)
        .limit(limit)
    )
    return list(session.exec(consulta).all())


def buscar(session: Session, filtros: FiltrosTransacciones, *, offset: int = 0, limit: int = 50) -> PaginaTransacciones:
    """Una página de resultados más los totales de *todas* las coincidencias.

    Los totales se calculan en SQL: si se sumaran solo los de la página, al
    pasar a la siguiente cambiarían.
    """
    consulta = _filtrar(
        select(Transaccion.tipo, func.count(), func.sum(Transaccion.monto_principal)), filtros
    ).group_by(col(Transaccion.tipo))
    por_tipo = {tipo: (cantidad, a_decimal(suma)) for tipo, cantidad, suma in session.exec(consulta).all()}
    cero = (0, Decimal("0.00"))
    return PaginaTransacciones(
        items=listar(session, filtros, offset=offset, limit=limit),
        total=sum(cantidad for cantidad, _ in por_tipo.values()),
        total_ingresos=por_tipo.get(TipoMovimiento.INGRESO, cero)[1],
        total_gastos=por_tipo.get(TipoMovimiento.GASTO, cero)[1],
    )


def obtener(session: Session, transaccion_id: int) -> Transaccion:
    return obtener_o_404(session, Transaccion, transaccion_id, "la transacción")


def validar_relaciones(
    session: Session, cuenta_id: int, categoria_id: int, tipo: TipoMovimiento
) -> Cuenta:
    """Comprueba que la cuenta y la categoría existen y que el tipo es coherente.

    Devuelve la cuenta porque se necesita su moneda para convertir el importe.
    """
    cuenta = obtener_referencia(session, Cuenta, cuenta_id, "la cuenta")
    categoria = obtener_referencia(session, Categoria, categoria_id, "la categoría")
    if categoria.tipo != tipo:
        raise ReglaDeNegocioError(
            f"La categoría '{categoria.nombre}' es de {categoria.tipo.value}, "
            f"no se puede usar en una transacción de {tipo.value}"
        )
    return cuenta


def completar_montos(session: Session, transaccion: Transaccion, cuenta: Cuenta) -> None:
    """Rellena la moneda y los importes convertidos con la tasa de su fecha.

    Lo usan también las suscripciones y los rendimientos, que crean
    transacciones por su cuenta.
    """
    transaccion.moneda = transaccion.moneda or cuenta.moneda
    principal = configuracion.moneda_principal(session)
    if transaccion.moneda != cuenta.moneda or transaccion.moneda != principal:
        divisas.asegurar_tasas_del_dia(session)
    transaccion.monto_cuenta = divisas.convertir(
        session, transaccion.monto, transaccion.moneda, cuenta.moneda, transaccion.fecha
    )
    transaccion.monto_principal = divisas.convertir(
        session, transaccion.monto, transaccion.moneda, principal, transaccion.fecha
    )


def _comprobar_editable(transaccion: Transaccion) -> None:
    """La comisión de una transferencia se gestiona desde la transferencia, para que no se descuadren."""
    if transaccion.transferencia_id is not None:
        raise ConflictoError("Esta comisión pertenece a una transferencia: edítala o bórrala desde Cuentas")


def crear(session: Session, datos: TransaccionCreate) -> Transaccion:
    cuenta = validar_relaciones(session, datos.cuenta_id, datos.categoria_id, datos.tipo)
    if datos.moneda is not None:
        configuracion.comprobar_moneda_activa(session, datos.moneda)
    transaccion = Transaccion.model_validate(datos)
    completar_montos(session, transaccion, cuenta)
    return guardar(session, transaccion)


def actualizar(session: Session, transaccion_id: int, cambios: TransaccionUpdate) -> Transaccion:
    transaccion = obtener(session, transaccion_id)
    _comprobar_editable(transaccion)
    datos = cambios_parciales(cambios, anulables=frozenset({"notas"}))

    # Validamos la combinación final (valores nuevos + los que no cambian),
    # porque un PATCH puede cambiar solo el tipo o solo la categoría.
    cuenta = validar_relaciones(
        session,
        datos.get("cuenta_id", transaccion.cuenta_id),
        datos.get("categoria_id", transaccion.categoria_id),
        datos.get("tipo", transaccion.tipo),
    )
    if "moneda" in datos:
        configuracion.comprobar_moneda_activa(session, datos["moneda"])
    transaccion.sqlmodel_update(datos)
    # El importe, la moneda, la fecha o la cuenta pueden haber cambiado.
    completar_montos(session, transaccion, cuenta)
    return guardar(session, transaccion)


def eliminar(session: Session, transaccion_id: int) -> None:
    transaccion = obtener(session, transaccion_id)
    _comprobar_editable(transaccion)
    session.delete(transaccion)
    session.commit()
