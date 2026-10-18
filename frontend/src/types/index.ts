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
export type Periodicidad = "semanal" | "mensual" | "anual";

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
}

export interface Presupuesto {
  id: number;
  categoria_id: number;
  monto_limite: Dinero;
  mes_anio: MesAnio;
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
  "id" | "fecha_ultimo_rendimiento" | "monto_cuenta" | "monto_principal"
>;

export interface PagoSuscripcion {
  transaccion: Transaccion;
  suscripcion: Suscripcion;
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
}

export interface ResumenMes {
  mes_anio: MesAnio;
  balance_global: Dinero;
  ingresos: Dinero;
  gastos: Dinero;
  flujo_neto: Dinero;
  cuentas: SaldoCuenta[];
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
  monto_limite: Dinero;
  gastado: Dinero;
  restante: Dinero;
  porcentaje: number;
  excedido: boolean;
}

// --- Configuración ---------------------------------------------------------
export interface Configuracion {
  /** Moneda principal: la de los totales, gráficos y presupuestos. */
  moneda: Moneda;
  monedas_activas: Moneda[];
}

export interface Tasa {
  moneda: Moneda;
  /** Unidades de `moneda` por 1 USD. */
  por_usd: string;
  fecha: FechaISO;
  origen: "api" | "manual";
}
