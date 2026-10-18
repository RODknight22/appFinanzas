/** Funciones para mostrar dinero, fechas y meses de forma legible. */
import { LOCALE, MONEDA } from "../config";
import type { Dinero, FechaISO, MesAnio } from "../types";

const formateadorDinero = new Intl.NumberFormat(LOCALE, { style: "currency", currency: MONEDA });

export function formatearDinero(valor: Dinero | number): string {
  return formateadorDinero.format(Number(valor));
}

/**
 * Las fechas ISO ("2026-10-18") se interpretan en UTC por defecto, lo que puede
 * mostrar el día anterior según la zona horaria. Las construimos en hora local.
 */
function fechaLocal(fecha: FechaISO): Date {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

export function formatearFecha(fecha: FechaISO): string {
  return fechaLocal(fecha).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatearMes(mes: MesAnio, formato: "corto" | "largo" = "largo"): string {
  const [anio, numeroMes] = mes.split("-").map(Number);
  return new Date(anio, numeroMes - 1, 1).toLocaleDateString(LOCALE, {
    month: formato === "corto" ? "short" : "long",
    year: formato === "corto" ? "2-digit" : "numeric",
  });
}

/** Fecha de hoy en formato ISO local, para valores por defecto de formularios. */
export function hoyISO(): FechaISO {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

export function mesActual(): MesAnio {
  return hoyISO().slice(0, 7);
}

/** Primer y último día de un mes, para filtrar transacciones con desde/hasta. */
export function rangoDelMes(mes: MesAnio): { desde: FechaISO; hasta: FechaISO } {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const ultimoDia = new Date(anio, numeroMes, 0).getDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimoDia).padStart(2, "0")}` };
}

/** Días que faltan hasta una fecha (negativo si ya pasó). */
export function diasHasta(fecha: FechaISO): number {
  const milisegundosPorDia = 24 * 60 * 60 * 1000;
  return Math.round((fechaLocal(fecha).getTime() - fechaLocal(hoyISO()).getTime()) / milisegundosPorDia);
}
