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
