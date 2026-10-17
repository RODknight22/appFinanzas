"""Modelos de base de datos.

Cada entidad tiene dos clases:
- `XBase`: los campos y validaciones comunes (se reutilizan en schemas.py).
- `X(XBase, table=True)`: la tabla real en SQLite, que añade `id` y claves foráneas.
"""

import re
from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import field_validator
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

# Usamos Decimal (y no float) para el dinero: 0.1 + 0.2 con float da
# 0.30000000000000004; con Decimal da exactamente 0.3.
MAX_DIGITOS = 12
DECIMALES = 2


# ---------------------------------------------------------------------------
# Enums: limitan los valores posibles de un campo y se validan automáticamente.
# ---------------------------------------------------------------------------
class TipoMovimiento(str, Enum):
    INGRESO = "ingreso"
    GASTO = "gasto"


class TipoCuenta(str, Enum):
    EFECTIVO = "efectivo"
    BANCO = "banco"
    TARJETA = "tarjeta"
    AHORRO = "ahorro"
    INVERSION = "inversion"


class Periodicidad(str, Enum):
    SEMANAL = "semanal"
    MENSUAL = "mensual"
    ANUAL = "anual"


# ---------------------------------------------------------------------------
# Validadores reutilizables (también los usan los schemas de actualización).
# ---------------------------------------------------------------------------
_PATRON_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
_PATRON_MES_ANIO = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def validar_color(valor: str | None) -> str | None:
    if valor is not None and not _PATRON_COLOR.match(valor):
        raise ValueError("El color debe tener formato hexadecimal, p. ej. '#22c55e'")
    return valor


def validar_mes_anio(valor: str | None) -> str | None:
    if valor is not None and not _PATRON_MES_ANIO.match(valor):
        raise ValueError("El mes debe tener formato 'YYYY-MM', p. ej. '2026-10'")
    return valor


# ---------------------------------------------------------------------------
# Cuentas
# ---------------------------------------------------------------------------
class CuentaBase(SQLModel):
    nombre: str = Field(min_length=1, max_length=100)
    tipo: TipoCuenta
    # Puede ser negativo (p. ej. una tarjeta de crédito con deuda inicial).
    balance_inicial: Decimal = Field(
        default=Decimal("0"), max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )


class Cuenta(CuentaBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


# ---------------------------------------------------------------------------
# Categorías
# ---------------------------------------------------------------------------
class CategoriaBase(SQLModel):
    nombre: str = Field(min_length=1, max_length=50)
    tipo: TipoMovimiento
    # Nombre de un icono de Lucide React (https://lucide.dev/icons).
    icono: str = Field(default="circle", max_length=50)
    color: str = Field(default="#64748b")

    @field_validator("color")
    @classmethod
    def comprobar_color(cls, valor: str | None) -> str | None:
        return validar_color(valor)


class Categoria(CategoriaBase, table=True):
    # La misma categoría puede existir como ingreso y como gasto, pero no repetida.
    __table_args__ = (UniqueConstraint("nombre", "tipo"),)

    id: int | None = Field(default=None, primary_key=True)


# ---------------------------------------------------------------------------
# Transacciones
# ---------------------------------------------------------------------------
class TransaccionBase(SQLModel):
    # Siempre positivo: el signo lo da `tipo` (ingreso suma, gasto resta).
    monto: Decimal = Field(gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES)
    tipo: TipoMovimiento
    # index=True acelera los filtros por fecha, cuenta y categoría del dashboard.
    fecha: date = Field(index=True)
    notas: str | None = Field(default=None, max_length=500)
    categoria_id: int = Field(foreign_key="categoria.id", index=True)
    cuenta_id: int = Field(foreign_key="cuenta.id", index=True)


class Transaccion(TransaccionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


# ---------------------------------------------------------------------------
# Presupuestos
# ---------------------------------------------------------------------------
class PresupuestoBase(SQLModel):
    categoria_id: int = Field(foreign_key="categoria.id", index=True)
    monto_limite: Decimal = Field(gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES)
    # Guardamos el mes como texto "YYYY-MM": es legible y se ordena correctamente.
    mes_anio: str

    @field_validator("mes_anio")
    @classmethod
    def comprobar_mes_anio(cls, valor: str | None) -> str | None:
        return validar_mes_anio(valor)


class Presupuesto(PresupuestoBase, table=True):
    # Solo un presupuesto por categoría y mes.
    __table_args__ = (UniqueConstraint("categoria_id", "mes_anio"),)

    id: int | None = Field(default=None, primary_key=True)


# ---------------------------------------------------------------------------
# Suscripciones (sin endpoints todavía)
# ---------------------------------------------------------------------------
class SuscripcionBase(SQLModel):
    nombre: str = Field(min_length=1, max_length=100)
    monto: Decimal = Field(gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES)
    periodicidad: Periodicidad
    fecha_proximo_pago: date


class Suscripcion(SuscripcionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
