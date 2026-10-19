"""Modelos de base de datos.

Cada entidad tiene dos clases:
- `XBase`: los campos y validaciones comunes (se reutilizan en schemas.py).
- `X(XBase, table=True)`: la tabla real en SQLite, que añade `id` y claves foráneas.
"""

import re
from datetime import date, datetime
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
    DEBITO = "debito"
    CREDITO = "credito"  # tarjeta de crédito: usa dia_corte, dia_pago y limite_credito
    RENDIMIENTOS = "rendimientos"  # cuenta con rendimientos diarios: usa tasa_rendimiento_anual
    AHORRO = "ahorro"
    INVERSION = "inversion"


class Periodicidad(str, Enum):
    SEMANAL = "semanal"
    MENSUAL = "mensual"
    ANUAL = "anual"


class Moneda(str, Enum):
    """Códigos ISO 4217: el frontend los usa para formatear con Intl.NumberFormat."""

    MXN = "MXN"  # peso mexicano
    USD = "USD"  # dólar estadounidense
    EUR = "EUR"  # euro
    GTQ = "GTQ"  # quetzal guatemalteco
    HNL = "HNL"  # lempira hondureño


class OrigenTasa(str, Enum):
    API = "api"  # descargada de internet
    MANUAL = "manual"  # escrita por el usuario (tiene prioridad sobre la de internet)

class ColorAcento(str, Enum):
    ESMERALDA = "esmeralda"
    AZUL = "azul"
    INDIGO = "indigo"
    VIOLETA = "violeta"
    ROSA = "rosa"
    NARANJA = "naranja"


class PaginaInicio(str, Enum):
    DASHBOARD = "dashboard"
    TRANSACCIONES = "transacciones"
    PRESUPUESTOS = "presupuestos"
    SUSCRIPCIONES = "suscripciones"
    CUENTAS = "cuentas"
    METAS = "metas"


class TamanoWidget(str, Enum):
    PEQUENO = "pequeno"  # 1 columna
    MEDIANO = "mediano"  # 2 columnas
    ANCHO = "ancho"  # 3 columnas
    GRANDE = "grande"  # ancho completo



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
    # Divisa de la cuenta. Si no se indica al crearla, se usa la moneda principal.
    moneda: Moneda | None = None
    # Puede ser negativo (p. ej. una tarjeta de crédito con deuda inicial).
    balance_inicial: Decimal = Field(
        default=Decimal("0"), max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    # --- Solo tarjetas de crédito (en otros tipos quedan en null) ---
    dia_corte: int | None = Field(default=None, ge=1, le=31)
    dia_pago: int | None = Field(default=None, ge=1, le=31)
    limite_credito: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    # --- Solo cuentas con rendimientos: tasa anual en %, p. ej. 10.5 ---
    tasa_rendimiento_anual: Decimal | None = Field(
        default=None, gt=0, le=100, max_digits=5, decimal_places=2
    )


class Cuenta(CuentaBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Lo gestiona el backend (no se envía en la API): hasta qué día se han
    # registrado ya los rendimientos, para no pagarlos dos veces.
    fecha_ultimo_rendimiento: date | None = None


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
    # Moneda en la que se pagó o cobró. Si no se indica, la de la cuenta.
    moneda: Moneda | None = None
    tipo: TipoMovimiento
    # index=True acelera los filtros por fecha, cuenta y categoría del dashboard.
    fecha: date = Field(index=True)
    notas: str | None = Field(default=None, max_length=500)
    categoria_id: int = Field(foreign_key="categoria.id", index=True)
    cuenta_id: int = Field(foreign_key="cuenta.id", index=True)


class Transaccion(TransaccionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Calculados por el backend con la tasa del día de la transacción:
    # - monto_cuenta: en la divisa de la cuenta (es lo que mueve su saldo).
    # - monto_principal: en la moneda principal (dashboard y presupuestos).
    monto_cuenta: Decimal | None = Field(
        default=None, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    monto_principal: Decimal | None = Field(
        default=None, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    # Solo en la comisión de una transferencia: se edita y borra junto con ella.
    transferencia_id: int | None = Field(default=None, foreign_key="transferencia.id", index=True)


# ---------------------------------------------------------------------------
# Transferencias entre cuentas
# ---------------------------------------------------------------------------
class TransferenciaBase(SQLModel):
    """Dinero que pasa de una cuenta a otra (incluido el pago de una tarjeta).

    No es ingreso ni gasto: el dinero sigue siendo tuyo. Por eso vive en su
    propia tabla y el dashboard no la suma en el flujo del mes.
    """

    cuenta_origen_id: int = Field(foreign_key="cuenta.id", index=True)
    cuenta_destino_id: int = Field(foreign_key="cuenta.id", index=True)
    # Lo que sale, en la moneda de la cuenta de origen.
    monto_origen: Decimal = Field(gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES)
    # Lo que llega, en la moneda de la cuenta de destino. Guardarlo registra el
    # tipo de cambio *real* que aplicó el banco. Si no se indica: igual que el
    # origen (misma moneda) o convertido con la tasa de la fecha.
    monto_destino: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    # Comisión cobrada en la cuenta de origen. Sí es un gasto: se anota como
    # una transacción enlazada en la categoría "Comisiones".
    comision: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    fecha: date = Field(index=True)
    notas: str | None = Field(default=None, max_length=500)


class Transferencia(TransferenciaBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


# ---------------------------------------------------------------------------
# Metas de ahorro
# ---------------------------------------------------------------------------
class MetaBase(SQLModel):
    """Un objetivo de ahorro ("Viaje a México: 1 500 EUR").

    El progreso se mide de una de dos formas:
    - Con `cuenta_id`: es el saldo de esa cuenta (una hucha o cajita dedicada).
    - Sin cuenta: es la suma de sus aportaciones, anotadas a mano. Así varias
      metas pueden repartirse el dinero de una misma cuenta.
    """

    nombre: str = Field(min_length=1, max_length=100)
    icono: str = Field(default="🎯", max_length=8)  # un emoji
    monto_objetivo: Decimal = Field(gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES)
    # Si no se indica: la de la cuenta vinculada o, si no hay, la principal.
    moneda: Moneda | None = None
    fecha_limite: date | None = None
    cuenta_id: int | None = Field(default=None, foreign_key="cuenta.id", index=True)


class Meta(MetaBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Día en que se alcanzó el objetivo. Se guarda para que la meta siga
    # "cumplida" aunque después se gaste parte del dinero.
    fecha_cumplida: date | None = None


class AportacionMetaBase(SQLModel):
    # Positivo = aportas; negativo = retiras dinero de la meta.
    monto: Decimal = Field(max_digits=MAX_DIGITOS, decimal_places=DECIMALES)
    fecha: date
    notas: str | None = Field(default=None, max_length=500)

    @field_validator("monto")
    @classmethod
    def comprobar_monto(cls, valor: Decimal) -> Decimal:
        if valor == 0:
            raise ValueError("La aportación no puede ser 0")
        return valor


class AportacionMeta(AportacionMetaBase, table=True):
    """Dinero apartado para una meta sin cuenta vinculada, en la moneda de la meta."""

    id: int | None = Field(default=None, primary_key=True)
    meta_id: int = Field(foreign_key="meta.id", index=True)


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
# Suscripciones
# ---------------------------------------------------------------------------
class SuscripcionBase(SQLModel):
    nombre: str = Field(min_length=1, max_length=100)
    monto: Decimal = Field(gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES)
    periodicidad: Periodicidad
    fecha_proximo_pago: date
    # Si no se indica al crearla, se usa la moneda principal.
    moneda: Moneda | None = None


class Suscripcion(SuscripcionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


# ---------------------------------------------------------------------------
# Configuración de la app (una sola fila, id = 1)
# ---------------------------------------------------------------------------
class Configuracion(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Moneda principal: en ella se suman los totales del dashboard y los presupuestos.
    moneda: Moneda = Moneda.MXN
    # Monedas que se ofrecen en los formularios, separadas por comas ("MXN,EUR").
    # null = todas. Texto simple porque SQLite no tiene un tipo lista.
    monedas_activas: str | None = None
    # --- Personalización (null = valor por defecto) ---
    nombre: str | None = Field(default=None, max_length=50)
    avatar: str | None = Field(default=None, max_length=8)  # un emoji; null = inicial del nombre
    color_acento: ColorAcento | None = None
    pagina_inicio: PaginaInicio | None = None
    # Día en que empieza el "mes financiero" (p. ej. el día de cobro). 1-28 para
    # que exista en todos los meses, febrero incluido.
    dia_inicio_mes: int | None = Field(default=None, ge=1, le=28)
    # Disposición del panel en JSON: [{"id": ..., "tamano": ..., "visible": ...}, ...]
    widgets: str | None = None
    # Foto de perfil (ya recortada y comprimida por el navegador) y su tipo MIME.
    foto: bytes | None = None
    foto_tipo: str | None = None


# ---------------------------------------------------------------------------
# Tasas de cambio (historial diario)
# ---------------------------------------------------------------------------
class TasaCambio(SQLModel, table=True):
    """Cuántas unidades de `moneda` equivalen a 1 USD en una fecha.

    Guardar todo respecto al dólar permite convertir entre cualquier par:
    EUR → MXN = monto / tasa(EUR) * tasa(MXN). El USD no se guarda: vale 1.
    """

    __table_args__ = (UniqueConstraint("fecha", "moneda"),)

    id: int | None = Field(default=None, primary_key=True)
    fecha: date = Field(index=True)
    moneda: Moneda
    por_usd: Decimal = Field(gt=0, max_digits=18, decimal_places=6)
    origen: OrigenTasa


# ---------------------------------------------------------------------------
# Acceso: un único usuario y sus sesiones abiertas
# ---------------------------------------------------------------------------
class Usuario(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    usuario: str = Field(min_length=1, max_length=50)
    # Nunca la contraseña en claro: "scrypt$n$r$p$sal$hash" (ver seguridad.py).
    password_hash: str


class Sesion(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Hash del token de la cookie: si alguien leyera la BD, no podría usarlo.
    token_hash: str = Field(index=True, unique=True)
    creada: datetime
    expira: datetime
