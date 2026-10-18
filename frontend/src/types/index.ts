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
export type TipoCuenta = "efectivo" | "banco" | "tarjeta" | "ahorro" | "inversion";
export type Periodicidad = "semanal" | "mensual" | "anual";

// --- Entidades -------------------------------------------------------------
export interface Cuenta {
  id: number;
  nombre: string;
  tipo: TipoCuenta;
  balance_inicial: Dinero;
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
  periodicidad: Periodicidad;
  fecha_proximo_pago: FechaISO;
}

/** Datos para crear una entidad: todo menos el `id`, que lo genera la BD. */
export type DatosNuevos<T extends { id: number }> = Omit<T, "id">;

export interface PagoSuscripcion {
  transaccion: Transaccion;
  suscripcion: Suscripcion;
}

// --- Dashboard -------------------------------------------------------------
export interface SaldoCuenta {
  cuenta_id: number;
  nombre: string;
  tipo: TipoCuenta;
  saldo: Dinero;
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
