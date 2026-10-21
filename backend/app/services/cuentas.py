"""Lógica de negocio de las cuentas."""

from datetime import date
from decimal import Decimal
from typing import Any

from sqlmodel import Session, col, select

from app.datos_iniciales import CATEGORIA_RENDIMIENTOS
from app.models import Cuenta, CuentaBase, IngresoRecurrente, Meta, TipoCuenta, TipoMovimiento, Transaccion, Transferencia
from app.schemas import CuentaCreate, CuentaUpdate
from app.services import categorias, configuracion
from app.services.comun import cambios_parciales, existe, guardar, obtener_o_404, obtener_referencia
from app.services.errores import ConflictoError, ReglaDeNegocioError
from app.services.saldos import CENTIMOS, saldo_actual
from app.services.transacciones import completar_montos

# Campos que solo tienen sentido en ciertos tipos de cuenta.
_CAMPOS_CREDITO = ("dia_corte", "dia_pago", "limite_credito")
_CAMPOS_RENDIMIENTOS = ("tasa_rendimiento_anual",)
# Campos opcionales que un PATCH puede vaciar con null.
_CAMPOS_ANULABLES = frozenset(
    _CAMPOS_CREDITO + _CAMPOS_RENDIMIENTOS + ("cuenta_padre_id", "numero_cuenta", "fijada")
)
# Niveles de subcuentas permitidos (1 = madre → subcuentas). El modelo admite más:
# para permitir subcuentas de subcuentas bastaría con subir este número.
MAX_NIVELES_SUBCUENTAS = 1


def listar(session: Session) -> list[Cuenta]:
    # Por nombre: las fijadas solo se destacan en la página de Cuentas y en el panel,
    # no en los desplegables de los formularios (ni cambian la cuenta por defecto).
    return list(session.exec(select(Cuenta).order_by(col(Cuenta.nombre))).all())


def obtener(session: Session, cuenta_id: int) -> Cuenta:
    return obtener_o_404(session, Cuenta, cuenta_id, "la cuenta")


def _comprobar_nombre_libre(session: Session, nombre: str, excluir_id: int | None = None) -> None:
    """Dos cuentas con el mismo nombre serían indistinguibles en la interfaz."""
    duplicada = session.exec(select(Cuenta).where(Cuenta.nombre == nombre)).first()
    if duplicada is not None and duplicada.id != excluir_id:
        raise ConflictoError(f"Ya existe una cuenta llamada '{nombre}'")


def _tiene_transferencias(session: Session, cuenta_id: int) -> bool:
    return existe(session, Transferencia.cuenta_origen_id, cuenta_id) or existe(
        session, Transferencia.cuenta_destino_id, cuenta_id
    )


def _niveles_por_debajo(session: Session, cuenta_id: int) -> int:
    """Cuántos niveles de subcuentas cuelgan de la cuenta (0 = ninguna)."""
    hijas = session.exec(select(Cuenta.id).where(Cuenta.cuenta_padre_id == cuenta_id)).all()
    return max((1 + _niveles_por_debajo(session, hija) for hija in hijas if hija is not None), default=0)


def _validar_padre(session: Session, padre_id: int | None, cuenta_id: int | None = None) -> None:
    """La madre debe existir y no ser la propia cuenta ni una de sus subcuentas
    (un ciclo), y el árbol no puede pasar de MAX_NIVELES_SUBCUENTAS."""
    if padre_id is None:
        return
    ancestro = obtener_referencia(session, Cuenta, padre_id, "la cuenta madre")
    niveles_encima = 0  # de la madre hacia arriba
    while True:
        if ancestro.id == cuenta_id:
            raise ReglaDeNegocioError("Una cuenta no puede ser subcuenta de sí misma ni de sus subcuentas")
        if ancestro.cuenta_padre_id is None:
            break
        ancestro = obtener(session, ancestro.cuenta_padre_id)
        niveles_encima += 1
    debajo = _niveles_por_debajo(session, cuenta_id) if cuenta_id is not None else 0
    if niveles_encima + 1 + debajo > MAX_NIVELES_SUBCUENTAS:
        raise ReglaDeNegocioError("Solo se admite un nivel de subcuentas: una subcuenta no puede tener subcuentas")


def _normalizar_por_tipo(datos: dict[str, Any]) -> dict[str, Any]:
    """Exige los campos propios del tipo de cuenta y borra los que no le corresponden.

    Así, si una tarjeta de crédito se convierte en cuenta de débito, no
    quedan restos de su día de corte en la base de datos.
    """
    tipo = datos["tipo"]
    if tipo == TipoCuenta.CREDITO:
        if datos.get("dia_corte") is None or datos.get("dia_pago") is None:
            raise ReglaDeNegocioError("Una tarjeta de crédito necesita día de corte y día de pago")
    else:
        datos.update(dict.fromkeys(_CAMPOS_CREDITO))

    if tipo == TipoCuenta.RENDIMIENTOS:
        if datos.get("tasa_rendimiento_anual") is None:
            raise ReglaDeNegocioError("Una cuenta con rendimientos necesita su tasa anual (%)")
    else:
        datos.update(dict.fromkeys(_CAMPOS_RENDIMIENTOS))
    return datos


def crear(session: Session, datos: CuentaCreate) -> Cuenta:
    _comprobar_nombre_libre(session, datos.nombre)
    _validar_padre(session, datos.cuenta_padre_id)
    cuenta = Cuenta(**_normalizar_por_tipo(datos.model_dump()))
    cuenta.moneda = cuenta.moneda or configuracion.moneda_principal(session)
    configuracion.comprobar_moneda_activa(session, cuenta.moneda)
    if cuenta.tipo == TipoCuenta.RENDIMIENTOS:
        # Los rendimientos empiezan a contar desde el día en que se crea la cuenta.
        cuenta.fecha_ultimo_rendimiento = date.today()
    return guardar(session, cuenta)


def actualizar(session: Session, cuenta_id: int, cambios: CuentaUpdate) -> Cuenta:
    cuenta = obtener(session, cuenta_id)
    enviados = cambios_parciales(cambios, anulables=_CAMPOS_ANULABLES)
    if "nombre" in enviados:
        _comprobar_nombre_libre(session, enviados["nombre"], excluir_id=cuenta_id)
    if "cuenta_padre_id" in enviados:
        _validar_padre(session, enviados["cuenta_padre_id"], cuenta_id)
    if enviados.get("moneda", cuenta.moneda) != cuenta.moneda:
        # Sus transacciones ya se convirtieron a la moneda antigua: cambiarla
        # dejaría el saldo mezclando dos divisas.
        if existe(session, Transaccion.cuenta_id, cuenta_id):
            raise ConflictoError("No se puede cambiar la moneda de una cuenta que ya tiene transacciones")
        if _tiene_transferencias(session, cuenta_id):
            raise ConflictoError("No se puede cambiar la moneda de una cuenta que ya tiene transferencias")
        configuracion.comprobar_moneda_activa(session, enviados["moneda"])

    # Validamos el estado final completo (lo actual + lo que cambia).
    actuales = cuenta.model_dump(include=set(CuentaBase.model_fields))
    cuenta.sqlmodel_update(_normalizar_por_tipo({**actuales, **enviados}))
    if cuenta.tipo == TipoCuenta.RENDIMIENTOS and cuenta.fecha_ultimo_rendimiento is None:
        cuenta.fecha_ultimo_rendimiento = date.today()
    return guardar(session, cuenta)


def eliminar(session: Session, cuenta_id: int) -> None:
    cuenta = obtener(session, cuenta_id)
    if existe(session, Cuenta.cuenta_padre_id, cuenta_id):
        raise ConflictoError("No se puede eliminar una cuenta que tiene subcuentas")
    # Borrarla dejaría transacciones huérfanas y descuadraría el balance.
    if existe(session, Transaccion.cuenta_id, cuenta_id):
        raise ConflictoError("No se puede eliminar una cuenta que tiene transacciones")
    if _tiene_transferencias(session, cuenta_id):
        raise ConflictoError("No se puede eliminar una cuenta que tiene transferencias")
    if existe(session, Meta.cuenta_id, cuenta_id):
        raise ConflictoError("No se puede eliminar una cuenta vinculada a una meta de ahorro")
    if existe(session, IngresoRecurrente.cuenta_id, cuenta_id):
        raise ConflictoError("No se puede eliminar una cuenta que usa un ingreso recurrente")
    session.delete(cuenta)
    session.commit()


# ---------------------------------------------------------------------------
# Rendimientos diarios
# ---------------------------------------------------------------------------
def calcular_rendimiento(saldo: Decimal, tasa_anual: Decimal, dias: int) -> Decimal:
    """Interés compuesto diario: saldo × ((1 + tasa/365)^días − 1).

    Es una estimación: usa el saldo actual para todo el periodo, mientras que
    el banco lo calcula con el saldo real de cada día.
    """
    tasa_diaria = tasa_anual / Decimal(100) / Decimal(365)
    return (saldo * ((1 + tasa_diaria) ** dias - 1)).quantize(CENTIMOS)


def registrar_rendimientos(session: Session, cuenta_id: int, hoy: date | None = None) -> Transaccion:
    """Anota como ingreso los rendimientos generados desde el último registro.

    `hoy` se puede indicar en los tests para simular el paso del tiempo.
    """
    hoy = hoy or date.today()
    cuenta = obtener(session, cuenta_id)
    if cuenta.tipo != TipoCuenta.RENDIMIENTOS or cuenta.tasa_rendimiento_anual is None:
        raise ReglaDeNegocioError("Esta cuenta no genera rendimientos")

    desde = cuenta.fecha_ultimo_rendimiento or hoy
    dias = (hoy - desde).days
    if dias <= 0:
        raise ReglaDeNegocioError("Los rendimientos ya están registrados hasta hoy")

    saldo = saldo_actual(session, cuenta)
    if saldo <= 0:
        raise ReglaDeNegocioError("La cuenta no tiene saldo positivo que genere rendimientos")

    monto = calcular_rendimiento(saldo, cuenta.tasa_rendimiento_anual, dias)
    if monto <= 0:
        raise ReglaDeNegocioError("El rendimiento acumulado aún es menor de 0.01; prueba en unos días")

    transaccion = Transaccion(
        monto=monto,
        moneda=cuenta.moneda,
        tipo=TipoMovimiento.INGRESO,
        fecha=hoy,
        notas=f"Rendimientos de {dias} día(s) al {cuenta.tasa_rendimiento_anual}% anual",
        cuenta_id=cuenta.id,
        categoria_id=categorias.de_la_app(session, CATEGORIA_RENDIMIENTOS, TipoMovimiento.INGRESO).id,
    )
    completar_montos(session, transaccion, cuenta)
    cuenta.fecha_ultimo_rendimiento = hoy

    # Un único commit: o se guardan el ingreso y la nueva fecha, o ninguno.
    session.add(transaccion)
    session.add(cuenta)
    session.commit()
    session.refresh(transaccion)
    return transaccion
