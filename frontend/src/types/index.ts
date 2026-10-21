/**
 * Tipos que reflejan los schemas del backend (backend/app/schemas.py).
 * Si cambias un schema en Python, actualiza aquí su equivalente.
 */

/** El backend envía los importes Decimal como texto ("12.50") para no perder precisión. */
export type Dinero = string;

/** Mes en formato "YYYY-MM". */
export type MesAnio = string;

/** Fecha en formato ISO "YYYY-MM-DD". */
export type FechaISO = string;

export type TipoMovimiento = "ingreso" | "gasto";
export type TipoCuenta = "efectivo" | "debito" | "credito" | "rendimientos" | "ahorro" | "inversion";
export type Moneda = "MXN" | "USD" | "EUR" | "GTQ" | "HNL";
export type Periodicidad = "diaria" | "semanal" | "quincenal" | "mensual" | "anual";

// --- Entidades -------------------------------------------------------------
export interface Cuenta {
  id: number;
  nombre: string;
  tipo: TipoCuenta;
  moneda: Moneda;
  balance_inicial: Dinero;
  // Solo tarjetas de crédito (null en el resto)
  dia_corte: number | null;
  dia_pago: number | null;
  limite_credito: Dinero | null;
  // Solo cuentas con rendimientos: tasa anual en % (null en el resto)
  tasa_rendimiento_anual: string | null;
  /** Subcuenta de otra (como los "bolsillos" por divisa de Revolut); null = cuenta principal. */
  cuenta_padre_id: number | null;
  /** IBAN, CLABE o número de cuenta: solo informativo. */
  numero_cuenta: string | null;
  /** Sale primero en la página de Cuentas y en el panel. */
  fijada: boolean | null;
  /** La gestiona el backend: hasta qué día se registraron los rendimientos. */
  readonly fecha_ultimo_rendimiento: FechaISO | null;
}

export interface Categoria {
  id: number;
  nombre: string;
  tipo: TipoMovimiento;
  icono: string;
  color: string;
}

export interface Transaccion {
  id: number;
  monto: Dinero;
  /** Moneda en la que se pagó; `monto` está en esta moneda. */
  moneda: Moneda;
  /** Calculados por el backend con la tasa del día de la transacción. */
  readonly monto_cuenta: Dinero;
  readonly monto_principal: Dinero;
  tipo: TipoMovimiento;
  fecha: FechaISO;
  notas: string | null;
  categoria_id: number;
  cuenta_id: number;
  /** Solo en la comisión de una transferencia: se gestiona desde la transferencia. */
  readonly transferencia_id: number | null;
}

/** Meta de ahorro con su progreso calculado por el backend (en la moneda de la meta). */
export interface Meta {
  id: number;
  nombre: string;
  /** Un emoji. */
  icono: string;
  monto_objetivo: Dinero;
  moneda: Moneda;
  fecha_limite: FechaISO | null;
  /** Con cuenta, el progreso es su saldo; sin ella, la suma de aportaciones. */
  cuenta_id: number | null;
  readonly fecha_cumplida: FechaISO | null;
  readonly ahorrado: Dinero;
  readonly restante: Dinero;
  readonly porcentaje: number;
  readonly cumplida: boolean;
  readonly vencida: boolean;
  readonly meses_restantes: number | null;
  /** Cuánto apartar al mes para llegar a la fecha límite. */
  readonly ahorro_mensual: Dinero | null;
}

export type DatosMeta = Pick<Meta, "nombre" | "icono" | "monto_objetivo" | "moneda" | "fecha_limite" | "cuenta_id">;

/** Dinero apartado (positivo) o retirado (negativo) de una meta sin cuenta. */
export interface AportacionMeta {
  id: number;
  meta_id: number;
  monto: Dinero;
  fecha: FechaISO;
  notas: string | null;
}

/** Resultado de /transacciones/buscar: una página y los totales de *todas* las coincidencias. */
export interface PaginaTransacciones {
  items: Transaccion[];
  total: number;
  /** En la moneda principal. */
  total_ingresos: Dinero;
  total_gastos: Dinero;
}

// --- Importar extractos bancarios -------------------------------------------
/** Un movimiento del archivo tal como se importaría (vista previa, aún sin guardar). */
export interface FilaImportacion {
  /** Fila en el archivo, para encontrarla. */
  fila: number;
  fecha: FechaISO;
  monto: Dinero;
  tipo: TipoMovimiento;
  concepto: string;
  categoria_id: number;
  /** alta = mismo concepto ya categorizado antes; media = parecido; ninguna = "Otros". */
  confianza: "alta" | "media" | "ninguna";
  /** Ya registrado en la cuenta: no se importa salvo que se marque. */
  duplicado: boolean;
}

export interface VistaPreviaImportacion {
  /** Qué columna del archivo se usó para cada dato, p. ej. { fecha: "F. Operación" }. */
  columnas: Record<string, string>;
  filas: FilaImportacion[];
  filas_ignoradas: number;
}

export type MovimientoImportado = Pick<FilaImportacion, "fecha" | "monto" | "tipo" | "concepto" | "categoria_id">;

/** Dinero que pasa de una cuenta a otra (no es ingreso ni gasto). */
export interface Transferencia {
  id: number;
  cuenta_origen_id: number;
  cuenta_destino_id: number;
  /** Lo que sale, en la moneda de la cuenta de origen. */
  monto_origen: Dinero;
  /** Lo que llega, en la moneda de destino. Al crear: null = estimarlo con la tasa de la fecha. */
  monto_destino: Dinero | null;
  /** Comisión en la moneda de origen (se anota como gasto). */
  comision: Dinero | null;
  fecha: FechaISO;
  notas: string | null;
}

export interface Presupuesto {
  id: number;
  categoria_id: number;
  monto_limite: Dinero;
  mes_anio: MesAnio;
  moneda: Moneda;
}

export interface Suscripcion {
  id: number;
  nombre: string;
  monto: Dinero;
  moneda: Moneda;
  periodicidad: Periodicidad;
  fecha_proximo_pago: FechaISO;
}

/** Datos para crear una entidad: sin `id` (lo genera la BD) ni campos que gestiona el backend. */
export type DatosNuevos<T extends { id: number }> = Omit<
  T,
  "id" | "fecha_ultimo_rendimiento" | "monto_cuenta" | "monto_principal" | "transferencia_id"
>;

export interface PagoSuscripcion {
  transaccion: Transaccion;
  suscripcion: Suscripcion;
}

export interface IngresoRecurrente {
  id: number;
  nombre: string;
  /** Importe habitual; al cobrar se puede indicar el que llegó de verdad. */
  monto: Dinero;
  moneda: Moneda;
  periodicidad: Periodicidad;
  fecha_proximo_cobro: FechaISO;
  cuenta_id: number;
  categoria_id: number;
  /** Cada N días/semanas/meses/años; null = 1. */
  intervalo: number | null;
  /** Días de la quincenal (31 = el último); null = 15 y último. */
  dia_quincena_1: number | null;
  dia_quincena_2: number | null;
  /** Día fijo de la mensual (31 = el último); null = el de la fecha. */
  dia_del_mes: number | null;
  /** Sábado o domingo → el viernes anterior. */
  adelantar_a_habil: boolean | null;
}

/** Lo que llegó de verdad: lo que se omita se toma del ingreso recurrente. */
export interface DatosCobro {
  monto?: Dinero;
  fecha?: FechaISO;
  cuenta_id?: number;
  notas?: string;
}

export interface CobroIngreso {
  transaccion: Transaccion;
  ingreso: IngresoRecurrente;
}

// --- Dashboard -------------------------------------------------------------
export interface SaldoCuenta {
  cuenta_id: number;
  nombre: string;
  tipo: TipoCuenta;
  moneda: Moneda;
  /** En la moneda de la cuenta. */
  saldo: Dinero;
  /** Convertido a la moneda principal con la tasa de hoy. */
  saldo_principal: Dinero;
  cuenta_padre_id: number | null;
  fijada: boolean;
}

export interface ResumenMes {
  mes_anio: MesAnio;
  balance_global: Dinero;
  ingresos: Dinero;
  gastos: Dinero;
  flujo_neto: Dinero;
  cuentas: SaldoCuenta[];
}

/** Dinero total al cierre de un mes, en la moneda principal. */
export interface PuntoPatrimonio {
  mes_anio: MesAnio;
  total: Dinero;
}

export interface GastoDiario {
  fecha: FechaISO;
  total: Dinero;
}

export interface FlujoMensual {
  mes_anio: MesAnio;
  ingresos: Dinero;
  gastos: Dinero;
  flujo_neto: Dinero;
}

export interface GastoPorCategoria {
  categoria_id: number;
  nombre: string;
  icono: string;
  color: string;
  total: Dinero;
  porcentaje: number;
}

export interface ProgresoPresupuesto {
  presupuesto_id: number;
  categoria_id: number;
  nombre: string;
  color: string;
  mes_anio: MesAnio;
  /** Límite, gastado y restante van en esta moneda. */
  moneda: Moneda;
  monto_limite: Dinero;
  gastado: Dinero;
  restante: Dinero;
  porcentaje: number;
  excedido: boolean;
  /** En la moneda principal, para sumar presupuestos de distintas monedas. */
  limite_principal: Dinero;
  gastado_principal: Dinero;
}

// --- Configuración ---------------------------------------------------------
export type ColorAcento = "esmeralda" | "azul" | "indigo" | "violeta" | "rosa" | "naranja";
export type PaginaInicio = "dashboard" | "transacciones" | "presupuestos" | "suscripciones" | "ingresos" | "efectivo" | "cuentas" | "metas";
export type TamanoWidget = "pequeno" | "mediano" | "ancho" | "grande";

export interface WidgetDisposicion {
  id: string;
  tamano: TamanoWidget;
  visible: boolean;
}

export interface Configuracion {
  /** Moneda principal: la de los totales, gráficos y presupuestos. */
  moneda: Moneda;
  monedas_activas: Moneda[];
  nombre: string | null;
  /** Un emoji; null = la inicial del nombre. */
  avatar: string | null;
  color_acento: ColorAcento;
  pagina_inicio: PaginaInicio;
  /** Día (1-28) en que empieza el mes financiero. */
  dia_inicio_mes: number;
  /** null = disposición por defecto del panel. */
  widgets: WidgetDisposicion[] | null;
  /** Cambia cada vez que se sube otra foto; null = sin foto. */
  foto_version: string | null;
  /** Primeros pasos: asistente inicial y tarjeta de bienvenida del panel. */
  tutorial_visto: boolean;
  bienvenida_cerrada: boolean;
  /** Bombillas con consejos junto a títulos y botones. */
  mostrar_consejos: boolean;
}

export interface Tasa {
  moneda: Moneda;
  /** Cuánto vale 1 unidad de `moneda` en la moneda principal ("1 EUR = 20.76 MXN"). */
  en_principal: string;
  fecha: FechaISO;
  origen: "api" | "manual";
}
