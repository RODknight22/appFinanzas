"""Schemas de la API: qué datos entran y salen por HTTP.

Separarlos de las tablas evita, por ejemplo, que un cliente envíe su propio `id`.
- `XCreate`: cuerpo de un POST (todos los campos obligatorios de XBase).
- `XRead`: respuesta de la API (incluye `id`).
- `XUpdate`: cuerpo de un PATCH (todo opcional: solo se cambia lo que se envía).
"""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import field_validator
from sqlmodel import Field, SQLModel

from app.models import (
    DECIMALES,
    MAX_DIGITOS,
    MetaBase,
    AportacionMetaBase,
    CategoriaBase,
    ColorAcento,
    CuentaBase,
    IngresoRecurrenteBase,
    Moneda,
    OrigenTasa,
    PaginaInicio,
    Periodicidad,
    PresupuestoBase,
    SuscripcionBase,
    TamanoWidget,
    TipoCuenta,
    TipoMovimiento,
    TransaccionBase,
    TransferenciaBase,
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
    transferencia_id: int | None = None


class PaginaTransacciones(SQLModel):
    """Resultado de una búsqueda: una página y los totales de todas las coincidencias."""

    items: list[TransaccionRead]
    total: int  # cuántas transacciones cumplen los filtros (no solo las de esta página)
    total_ingresos: Decimal  # en la moneda principal
    total_gastos: Decimal


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


# --- Importar extractos bancarios -------------------------------------------
class FilaImportacion(SQLModel):
    """Un movimiento del archivo tal como se importaría (vista previa, aún sin guardar)."""

    fila: int  # en el archivo, para que el usuario lo encuentre
    fecha: date
    monto: Decimal  # positivo: el signo lo da `tipo`
    tipo: TipoMovimiento
    concepto: str
    categoria_id: int
    # alta = mismo concepto ya categorizado antes; media = parecido; ninguna = "Otros".
    confianza: Literal["alta", "media", "ninguna"]
    # Ya registrado en la cuenta (como transacción o transferencia): no se importa por defecto.
    duplicado: bool


class VistaPreviaImportacion(SQLModel):
    columnas: dict[str, str]  # qué columna del archivo se usó para cada dato
    filas: list[FilaImportacion]
    filas_ignoradas: int


class MovimientoImportado(SQLModel):
    fecha: date
    monto: Decimal = Field(gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES)
    tipo: TipoMovimiento
    concepto: str = Field(max_length=500)
    categoria_id: int


class ImportacionCreate(SQLModel):
    cuenta_id: int
    movimientos: list[MovimientoImportado] = Field(min_length=1, max_length=5000)


class ResultadoImportacion(SQLModel):
    creadas: int


# --- Transferencias --------------------------------------------------------
class TransferenciaCreate(TransferenciaBase):
    pass


class TransferenciaRead(TransferenciaBase):
    id: int
    monto_destino: Decimal  # siempre relleno al guardar


class TransferenciaUpdate(SQLModel):
    cuenta_origen_id: int | None = None
    cuenta_destino_id: int | None = None
    monto_origen: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    monto_destino: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    comision: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    fecha: date | None = None
    notas: str | None = Field(default=None, max_length=500)


# --- Metas de ahorro -------------------------------------------------------
class MetaCreate(MetaBase):
    pass


class MetaUpdate(SQLModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    icono: str | None = Field(default=None, max_length=8)
    monto_objetivo: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    moneda: Moneda | None = None
    fecha_limite: date | None = None
    cuenta_id: int | None = None
    # Marcarla a mano como cumplida (p. ej. ya compraste lo que querías) o reabrirla.
    cumplida: bool | None = None


class MetaRead(MetaBase):
    """La meta con su progreso calculado (en la moneda de la meta)."""

    id: int
    moneda: Moneda
    fecha_cumplida: date | None
    ahorrado: Decimal
    restante: Decimal  # 0 si ya se alcanzó
    porcentaje: float
    cumplida: bool
    # Con fecha límite y aún sin cumplir:
    vencida: bool  # la fecha ya pasó
    meses_restantes: int | None
    ahorro_mensual: Decimal | None  # cuánto apartar al mes para llegar a tiempo


class AportacionMetaCreate(AportacionMetaBase):
    pass


class AportacionMetaRead(AportacionMetaBase):
    id: int
    meta_id: int


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
    moneda: Moneda | None = None

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


# --- Ingresos recurrentes --------------------------------------------------
class IngresoRecurrenteCreate(IngresoRecurrenteBase):
    pass


class IngresoRecurrenteRead(IngresoRecurrenteBase):
    id: int


class IngresoRecurrenteUpdate(SQLModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    monto: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    moneda: Moneda | None = None
    periodicidad: Periodicidad | None = None
    fecha_proximo_cobro: date | None = None
    cuenta_id: int | None = None
    categoria_id: int | None = None


class CobroIngresoCreate(SQLModel):
    """Lo que llegó de verdad; lo que no se envíe se toma del ingreso recurrente."""

    monto: Decimal | None = Field(
        default=None, gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES
    )
    fecha: date | None = None
    cuenta_id: int | None = None
    notas: str | None = Field(default=None, max_length=500)


class CobroIngresoRead(SQLModel):
    """Resultado del cobro: la transacción creada y el ingreso con su nueva fecha."""

    transaccion: TransaccionRead
    ingreso: IngresoRecurrenteRead


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


class PuntoPatrimonio(SQLModel):
    """Dinero total (todas las cuentas, en la moneda principal) al cierre de un mes."""

    mes_anio: str
    total: Decimal


class GastoDiario(SQLModel):
    fecha: date
    total: Decimal  # en la moneda principal


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
    # Límite, gastado y restante van en la moneda del presupuesto.
    moneda: Moneda
    monto_limite: Decimal
    gastado: Decimal
    restante: Decimal
    porcentaje: float
    excedido: bool
    # En la moneda principal, para poder sumar presupuestos de distintas monedas.
    limite_principal: Decimal
    gastado_principal: Decimal


# --- Configuración y divisas -----------------------------------------------
class WidgetDisposicion(SQLModel):
    """Un widget del panel: cuál es, de qué tamaño y si se muestra."""

    id: str = Field(min_length=1, max_length=40)
    tamano: TamanoWidget
    visible: bool = True


class ConfiguracionRead(SQLModel):
    moneda: Moneda
    monedas_activas: list[Moneda]
    nombre: str | None
    avatar: str | None
    color_acento: ColorAcento
    pagina_inicio: PaginaInicio
    dia_inicio_mes: int
    # null = el frontend usa su disposición por defecto
    widgets: list[WidgetDisposicion] | None
    # Huella de la foto (cambia al subir otra): sirve para que el navegador no use una copia vieja.
    foto_version: str | None


class ConfiguracionUpdate(SQLModel):
    """PATCH: solo se cambia lo que se envía (un null explícito borra nombre o avatar)."""

    moneda: Moneda | None = None
    monedas_activas: list[Moneda] | None = None
    nombre: str | None = Field(default=None, max_length=50)
    avatar: str | None = Field(default=None, max_length=8)
    color_acento: ColorAcento | None = None
    pagina_inicio: PaginaInicio | None = None
    dia_inicio_mes: int | None = Field(default=None, ge=1, le=28)
    widgets: list[WidgetDisposicion] | None = Field(default=None, max_length=30)


class FotoPerfil(SQLModel):
    """Imagen como "data URL": data:image/jpeg;base64,/9j/4AAQ…"""

    imagen: str = Field(max_length=700_000)


class TasaRead(SQLModel):
    """Cuánto vale 1 unidad de `moneda` en la moneda principal (1 EUR = 20.76 MXN)."""

    moneda: Moneda
    en_principal: Decimal
    fecha: date
    origen: OrigenTasa


class TasaManual(SQLModel):
    en_principal: Decimal = Field(ge=Decimal("0.000001"), le=Decimal(1_000_000), max_digits=18, decimal_places=6)


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
