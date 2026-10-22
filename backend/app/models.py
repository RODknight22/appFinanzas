"""Modelos de base de datos.

Cada entidad tiene dos clases:
- `XBase`: los campos y validaciones comunes (se reutilizan en schemas.py).
- `X(XBase, table=True)`: la tabla real en SQLite, que añade `id` y claves foráneas.
"""

import re
from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import NaiveDatetime, field_validator
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

# Usamos Decimal (y no float) para el dinero: 0.1 + 0.2 con float da
# 0.30000000000000004; con Decimal da exactamente 0.3.
MAX_DIGITOS = 12
DECIMALES = 2
MAX_INTERVALO = 365  # "cada 365 días" es lo más largo que tiene sentido


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
    DIARIA = "diaria"  # con `intervalo`: cada N días
    SEMANAL = "semanal"
    QUINCENAL = "quincenal"  # días 15 y último del mes, como las nóminas en México
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
    INGRESOS = "ingresos"
    EFECTIVO = "efectivo"
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


_PATRON_ENLACE = re.compile(r"^https?://[^\s/$.?#][^\s]*$", re.IGNORECASE)


def validar_enlace(valor: str | None) -> str | None:
    """Solo http(s): el enlace acaba en un <a href> y un "javascript:" ejecutaría código."""
    if valor is None or valor.strip() == "":
        return None
    valor = valor.strip()
    if not _PATRON_ENLACE.match(valor):
        raise ValueError("El enlace debe empezar por http:// o https://")
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
    # Subcuenta de otra (como Revolut: una cuenta con "bolsillos" en varias divisas).
    # Cada una tiene su saldo y su moneda; la madre muestra además el total.
    cuenta_padre_id: int | None = Field(default=None, foreign_key="cuenta.id")
    # IBAN, CLABE o número de cuenta: solo informativo.
    numero_cuenta: str | None = Field(default=None, max_length=50)
    # Fijada: sale primero en la lista y en el panel.
    fijada: bool | None = None


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
    # El límite está en esta moneda; si no se indica al crearlo, la principal.
    moneda: Moneda | None = None

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
# Ingresos recurrentes
# ---------------------------------------------------------------------------
class IngresoRecurrenteBase(SQLModel):
    """Un ingreso que llega cada cierto tiempo (nómina, renta, envío desde México).

    Guarda la cuenta y la categoría para que registrar el cobro sea un clic.
    """

    nombre: str = Field(min_length=1, max_length=100)
    # Importe habitual: al cobrar se puede indicar otro si ese mes llegó distinto.
    monto: Decimal = Field(gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES)
    # Si no se indica al crearlo, la moneda de su cuenta.
    moneda: Moneda | None = None
    periodicidad: Periodicidad
    fecha_proximo_cobro: date = Field(index=True)
    cuenta_id: int = Field(foreign_key="cuenta.id", index=True)
    categoria_id: int = Field(foreign_key="categoria.id", index=True)
    # Ajustes del calendario (services/periodicidad.py); null = el comportamiento clásico.
    intervalo: int | None = Field(default=None, ge=1, le=MAX_INTERVALO)  # cada N periodos
    # Días de cobro de la quincenal (31 = el último del mes); null = 15 y último.
    dia_quincena_1: int | None = Field(default=None, ge=1, le=31)
    dia_quincena_2: int | None = Field(default=None, ge=1, le=31)
    # Día fijo de la mensual (31 = el último); null = el de la fecha del próximo cobro.
    dia_del_mes: int | None = Field(default=None, ge=1, le=31)
    adelantar_a_habil: bool | None = None  # sábado o domingo → el viernes anterior


class IngresoRecurrente(IngresoRecurrenteBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


# ---------------------------------------------------------------------------
# Deudas (quién te debe y a quién le debes)
# ---------------------------------------------------------------------------
class SentidoDeuda(str, Enum):
    ME_DEBEN = "me_deben"  # prestaste: te lo tienen que devolver
    DEBO = "debo"  # te prestaron: lo tienes que devolver


class DeudaBase(SQLModel):
    """Dinero prestado entre tú y otra persona.

    Como una transferencia, no es gasto ni ingreso: con `cuenta_id`, el préstamo
    mueve el saldo de esa cuenta (prestar resta, que te presten suma) y cada abono
    lo devuelve. Sin cuenta es solo un apunte (p. ej. una deuda de antes de la app).
    """

    persona: str = Field(min_length=1, max_length=100)
    sentido: SentidoDeuda
    monto: Decimal = Field(gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES)
    # Si no se indica: la de la cuenta o, sin cuenta, la principal.
    moneda: Moneda | None = None
    fecha: date
    fecha_vencimiento: date | None = None
    cuenta_id: int | None = Field(default=None, foreign_key="cuenta.id", index=True)
    notas: str | None = Field(default=None, max_length=500)


class Deuda(DeudaBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Día del abono que dejó la deuda a cero (null = pendiente).
    fecha_saldada: date | None = None


class AbonoDeudaBase(SQLModel):
    """Una devolución (parcial o total) de una deuda, en la moneda de la deuda."""

    monto: Decimal = Field(gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES)
    fecha: date
    # Cuenta donde entra (si te pagan) o de donde sale (si pagas); null = sin mover dinero.
    cuenta_id: int | None = Field(default=None, foreign_key="cuenta.id", index=True)
    notas: str | None = Field(default=None, max_length=500)


class AbonoDeuda(AbonoDeudaBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    deuda_id: int = Field(foreign_key="deuda.id", index=True)


# ---------------------------------------------------------------------------
# Lista de deseos y "máquina del tiempo"
# ---------------------------------------------------------------------------
class PrioridadDeseo(str, Enum):
    ALTA = "alta"
    MEDIA = "media"
    BAJA = "baja"


class EstadoDeseo(str, Enum):
    EN_REFLEXION = "en_reflexion"  # congelado hasta `reflexion_hasta` (máquina del tiempo)
    DESEADO = "deseado"  # en la lista
    COMPRADO = "comprado"
    DESCARTADO = "descartado"  # dinero que no gastaste


class DeseoBase(SQLModel):
    """Algo que quieres comprar. Puede ir ligado a una meta de ahorro.

    El enlace (Amazon, SHEIN…) se guarda tal cual; más adelante se podría seguir
    su precio añadiendo columnas opcionales (precio_actual, revisado_en…).
    """

    nombre: str = Field(min_length=1, max_length=100)
    precio: Decimal = Field(gt=0, max_digits=MAX_DIGITOS, decimal_places=DECIMALES)
    # Si no se indica: la principal.
    moneda: Moneda | None = None
    enlace: str | None = Field(default=None, max_length=500)
    prioridad: PrioridadDeseo = PrioridadDeseo.MEDIA
    notas: str | None = Field(default=None, max_length=500)
    meta_id: int | None = Field(default=None, foreign_key="meta.id", index=True)
    # Carta al yo del futuro: por qué lo quieres. Se lee al acabar la reflexión.
    carta: str | None = Field(default=None, max_length=1000)

    @field_validator("enlace")
    @classmethod
    def comprobar_enlace(cls, valor: str | None) -> str | None:
        return validar_enlace(valor)


class Deseo(DeseoBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    estado: EstadoDeseo = EstadoDeseo.DESEADO
    # Hora local "sin zona", como la del navegador que muestra la cuenta atrás.
    creado: NaiveDatetime
    reflexion_hasta: NaiveDatetime | None = None
    fecha_decision: date | None = None  # cuándo se compró o se descartó


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
    # --- Primeros pasos (null = aún no) ---
    tutorial_visto: bool | None = None  # asistente inicial completado o saltado
    bienvenida_cerrada: bool | None = None  # tarjeta de primeros pasos del panel
    mostrar_consejos: bool | None = None  # null = sí
    # --- Recordatorio diario de anotar gastos (null = desactivado) ---
    recordatorio_diario: bool | None = None
    hora_recordatorio: int | None = Field(default=None, ge=0, le=23)  # null = 21 h
    # Para enviarlo por correo en el futuro: hoy solo se guarda.
    correo_recordatorios: str | None = Field(default=None, max_length=254)


class NotificacionLeida(SQLModel, table=True):
    """Avisos ya leídos. Los avisos se calculan al vuelo (services/notificaciones.py);
    aquí solo se guarda su clave estable, p. ej. "suscripcion:5:2026-10-25"."""

    id: int | None = Field(default=None, primary_key=True)
    clave: str = Field(max_length=200, unique=True, index=True)
    leida_en: NaiveDatetime


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
    # UTC "sin zona" (SQLite no guarda zonas): NaiveDatetime se lo dice a SQLModel,
    # que desde la 0.0.4x exige fechas con zona salvo que se indique así.
    creada: NaiveDatetime
    expira: NaiveDatetime
