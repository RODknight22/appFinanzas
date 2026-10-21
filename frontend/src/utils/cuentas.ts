/** Cálculos de las cuentas especiales: tarjetas de crédito y rendimientos. */
import type { Cuenta, FechaISO, Moneda, Suscripcion } from "../types";
import { diasHasta, hoyISO } from "./formato";

/**
 * Próxima fecha (hoy incluido) en que cae un día del mes.
 * Si el mes es más corto, usa su último día: "día 31" en febrero = 28/29.
 */
export function proximaFechaDelDia(dia: number, desde: FechaISO = hoyISO()): FechaISO {
  const [anio, mes, diaHoy] = desde.split("-").map(Number);
  const fechaEnMes = (a: number, m: number) => {
    const ultimoDia = new Date(a, m, 0).getDate(); // m es 1-12; el día 0 = último del mes anterior
    const d = Math.min(dia, ultimoDia);
    return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  const esteMes = fechaEnMes(anio, mes);
  if (Number(esteMes.slice(8)) >= diaHoy) return esteMes;
  return mes === 12 ? fechaEnMes(anio + 1, 1) : fechaEnMes(anio, mes + 1);
}

/**
 * Rendimiento estimado con interés compuesto diario (misma fórmula que el backend).
 * Solo para mostrar: el importe real lo calcula y guarda el backend.
 */
export function rendimientoEstimado(saldo: number, tasaAnual: number, dias: number): number {
  if (saldo <= 0) return 0;
  return saldo * ((1 + tasaAnual / 100 / 365) ** dias - 1);
}

export interface PagoProximo {
  clave: string;
  nombre: string;
  fecha: FechaISO;
  monto: number;
  moneda: Moneda;
  origen: "suscripcion" | "tarjeta";
}

/**
 * Une en una lista ordenada por fecha los cobros de suscripciones y los
 * pagos de tarjetas de crédito (solo si tienen deuda) de los próximos días.
 */
export function proximosPagos(
  suscripciones: Suscripcion[],
  cuentas: Cuenta[],
  saldoPorCuenta: Map<number, number>,
  dias: number,
): PagoProximo[] {
  const pagos: PagoProximo[] = suscripciones.map((s) => ({
    clave: `suscripcion-${s.id}`,
    nombre: s.nombre,
    fecha: s.fecha_proximo_pago,
    monto: Number(s.monto),
    moneda: s.moneda,
    origen: "suscripcion",
  }));

  for (const cuenta of cuentas) {
    const deuda = -(saldoPorCuenta.get(cuenta.id) ?? 0);
    if (cuenta.tipo !== "credito" || !cuenta.dia_pago || deuda <= 0) continue;
    const fecha = proximaFechaDelDia(cuenta.dia_pago);
    if (diasHasta(fecha) <= dias) {
      pagos.push({
        clave: `tarjeta-${cuenta.id}`,
        nombre: `Pago ${cuenta.nombre}`,
        fecha,
        monto: deuda,
        moneda: cuenta.moneda,
        origen: "tarjeta",
      });
    }
  }
  // Las fechas ISO se ordenan bien como texto ("2026-10-05" < "2026-10-18").
  return pagos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Para mostrar: las fijadas arriba y después por nombre (los formularios mantienen el orden por nombre). */
function ordenarCuentas(cuentas: Cuenta[]): Cuenta[] {
  return [...cuentas].sort((a, b) => Number(Boolean(b.fijada)) - Number(Boolean(a.fijada)) || a.nombre.localeCompare(b.nombre));
}

export interface GrupoCuentas {
  cuenta: Cuenta;
  subcuentas: Cuenta[];
}

/**
 * Cuentas madre con sus subcuentas debajo, ambas ordenadas (fijadas primero).
 * Una subcuenta cuya madre no esté en la lista se muestra como cuenta suelta.
 */
export function agruparCuentas(cuentas: Cuenta[]): GrupoCuentas[] {
  const ids = new Set(cuentas.map((c) => c.id));
  const esSubcuenta = (c: Cuenta) => c.cuenta_padre_id !== null && ids.has(c.cuenta_padre_id);
  return ordenarCuentas(cuentas.filter((c) => !esSubcuenta(c))).map((cuenta) => ({
    cuenta,
    subcuentas: ordenarCuentas(cuentas.filter((c) => c.cuenta_padre_id === cuenta.id)),
  }));
}
