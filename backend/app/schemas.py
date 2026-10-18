"""Schemas de la API: qué datos entran y salen por HTTP.

Separarlos de las tablas evita, por ejemplo, que un cliente envíe su propio `id`.
- `XCreate`: cuerpo de un POST (todos los campos obligatorios de XBase).
- `XRead`: respuesta de la API (incluye `id`).
- `XUpdate`: cuerpo de un PATCH (todo opcional: solo se cambia lo que se envía).
"""

from datetime import date
from decimal import Decimal

from pydantic import field_validator
from sqlmodel import Field, SQLModel

from app.models import (
    DECIMALES,
    MAX_DIGITOS,
    CategoriaBase,
    CuentaBase,
    Moneda,
    OrigenTasa,
    Periodicidad,
    PresupuestoBase,
    SuscripcionBase,
    TipoCuenta,
    TipoMovimiento,
    TransaccionBase,
    validar_color,
    validar_mes_anio,
)


# --- Cuentas ---------------------------------------------------------------
class CuentaCreate(CuentaBase):
    pass


class CuentaRead(CuentaBase):
    id: int
    fecha_ultimo_rendimiento: date | None = None


class CuentaUpdate(SQLModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    tipo: TipoCuenta | None = None
    moneda: Moneda | None = None
    balance_inicial: Decimal | None = Field(
        default=None, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    dia_corte: int | None = Field(default=None, ge=1, le=31)
    dia_pago: int | None = Field(default=None, ge=1, le=31)
    limite_credito: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    tasa_rendimiento_anual: Decimal | None = Field(
        default=None, gt=0, le=100, max_digits=5, decimal_places=2
    )


# --- Categorías ------------------------------------------------------------
class CategoriaCreate(CategoriaBase):
    pass


class CategoriaRead(CategoriaBase):
    id: int


class CategoriaUpdate(SQLModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=50)
    tipo: TipoMovimiento | None = None
    icono: str | None = Field(default=None, max_length=50)
    color: str | None = None

    @field_validator("color")
    @classmethod
    def comprobar_color(cls, valor: str | None) -> str | None:
        return validar_color(valor)


# --- Transacciones ---------------------------------------------------------
class TransaccionCreate(TransaccionBase):
    pass


class TransaccionRead(TransaccionBase):
    id: int
    monto_cuenta: Decimal
    monto_principal: Decimal


class TransaccionUpdate(SQLModel):
    monto: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    moneda: Moneda | None = None
    tipo: TipoMovimiento | None = None
    fecha: date | None = None
    notas: str | None = Field(default=None, max_length=500)
    categoria_id: int | None = None
    cuenta_id: int | None = None


# --- Presupuestos ----------------------------------------------------------
class PresupuestoCreate(PresupuestoBase):
    pass


class PresupuestoRead(PresupuestoBase):
    id: int


class PresupuestoUpdate(SQLModel):
    categoria_id: int | None = None
    monto_limite: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    mes_anio: str | None = None

    @field_validator("mes_anio")
    @classmethod
    def comprobar_mes_anio(cls, valor: str | None) -> str | None:
        return validar_mes_anio(valor)


# --- Suscripciones ---------------------------------------------------------
class SuscripcionCreate(SuscripcionBase):
    pass


class SuscripcionRead(SuscripcionBase):
    id: int


class SuscripcionUpdate(SQLModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    monto: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    periodicidad: Periodicidad | None = None
    fecha_proximo_pago: date | None = None
    moneda: Moneda | None = None


class PagoSuscripcionCreate(SQLModel):
    """Datos para registrar un cobro: de qué cuenta sale y en qué categoría se anota."""

    cuenta_id: int
    categoria_id: int


class PagoSuscripcionRead(SQLModel):
    """Resultado del cobro: la transacción creada y la suscripción con su nueva fecha."""

    transaccion: TransaccionRead
    suscripcion: SuscripcionRead


# --- Dashboard (solo lectura: datos calculados, no tablas) -----------------
class SaldoCuenta(SQLModel):
    cuenta_id: int
    nombre: str
    tipo: TipoCuenta
    moneda: Moneda
    saldo: Decimal  # en la moneda de la cuenta
    saldo_principal: Decimal  # convertido a la moneda principal con la tasa de hoy


class ResumenMes(SQLModel):
    mes_anio: str
    balance_global: Decimal
    ingresos: Decimal
    gastos: Decimal
    flujo_neto: Decimal
    cuentas: list[SaldoCuenta]


class FlujoMensual(SQLModel):
    mes_anio: str
    ingresos: Decimal
    gastos: Decimal
    flujo_neto: Decimal


class GastoPorCategoria(SQLModel):
    categoria_id: int
    nombre: str
    icono: str
    color: str
    total: Decimal
    porcentaje: float


class ProgresoPresupuesto(SQLModel):
    presupuesto_id: int
    categoria_id: int
    nombre: str
    color: str
    mes_anio: str
    monto_limite: Decimal
    gastado: Decimal
    restante: Decimal
    porcentaje: float
    excedido: bool


# --- Configuración y divisas -----------------------------------------------
class ConfiguracionRead(SQLModel):
    moneda: Moneda
    monedas_activas: list[Moneda]


class ConfiguracionUpdate(SQLModel):
    """PATCH: solo se cambia lo que se envía."""

    moneda: Moneda | None = None
    monedas_activas: list[Moneda] | None = None


class TasaRead(SQLModel):
    moneda: Moneda
    por_usd: Decimal
    fecha: date
    origen: OrigenTasa


class TasaManual(SQLModel):
    por_usd: Decimal = Field(gt=0, max_digits=18, decimal_places=6)


# --- Acceso (login) --------------------------------------------------------
class DatosLogin(SQLModel):
    usuario: str = Field(min_length=1, max_length=50)
    contrasena: str = Field(min_length=1, max_length=128)


class DatosRegistro(DatosLogin):
    # Al crearla sí exigimos un mínimo; al iniciar sesión no (daría pistas).
    contrasena: str = Field(min_length=8, max_length=128)


class CambioContrasena(SQLModel):
    actual: str = Field(min_length=1, max_length=128)
    nueva: str = Field(min_length=8, max_length=128)


class EstadoAcceso(SQLModel):
    configurado: bool  # ¿ya se creó el usuario?
    autenticado: bool  # ¿esta petición trae una sesión válida?
    usuario: str | None = None
