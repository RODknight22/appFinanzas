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


class CuentaUpdate(SQLModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    tipo: TipoCuenta | None = None
    balance_inicial: Decimal | None = Field(
        default=None, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
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


class TransaccionUpdate(SQLModel):
    monto: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
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


class PagoSuscripcionCreate(SQLModel):
    """Datos para registrar un cobro: de qué cuenta sale y en qué categoría se anota."""

    cuenta_id: int
    categoria_id: int


class PagoSuscripcionRead(SQLModel):
    """Resultado del cobro: la transacción creada y la suscripción con su nueva fecha."""

    transaccion: TransaccionRead
    suscripcion: SuscripcionRead
