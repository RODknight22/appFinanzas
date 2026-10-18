/** Funciones para mostrar dinero, fechas y meses de forma legible. */
import { MONEDA_POR_DEFECTO, MONEDAS } from "../config";
import type { Dinero, FechaISO, MesAnio, Moneda } from "../types";

// Estado del módulo: lo cambia configurarMoneda() al cargar o cambiar la moneda principal.
let monedaPrincipal: Moneda = MONEDA_POR_DEFECTO;
let localeActual = MONEDAS[MONEDA_POR_DEFECTO].locale;

// Crear un Intl.NumberFormat es costoso: guardamos uno por moneda y lo reutilizamos.
const formateadores = new Map<Moneda, Intl.NumberFormat>();

/**
 * Todas las monedas se formatean con la región de la moneda principal: así la
 * principal usa su símbolo ("$") y las demás su código ("USD 15.00"). Si cada
 * una usara su propia región, MXN y USD saldrían ambas como "$".
 */
function formateador(moneda: Moneda): Intl.NumberFormat {
  let existente = formateadores.get(moneda);
  if (!existente) {
    existente = new Intl.NumberFormat(localeActual, { style: "currency", currency: moneda });
    formateadores.set(moneda, existente);
  }
  return existente;
}

/** Cambia la moneda principal (y el formato regional de fechas) de toda la app. */
export function configurarMoneda(moneda: Moneda): void {
  monedaPrincipal = moneda;
  localeActual = MONEDAS[moneda].locale;
  formateadores.clear(); // los formatos dependen de la región: hay que rehacerlos
}

/** Formatea un importe en `moneda` (por defecto, la principal): "$1,234.50", "1.234,50 €"… */
export function formatearDinero(valor: Dinero | number, moneda: Moneda = monedaPrincipal): string {
  return formateador(moneda).format(Number(valor));
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
  return fechaLocal(fecha).toLocaleDateString(localeActual, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatearMes(mes: MesAnio, formato: "corto" | "largo" = "largo"): string {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const texto = new Date(anio, numeroMes - 1, 1).toLocaleDateString(localeActual, {
    month: formato === "corto" ? "short" : "long",
    year: formato === "corto" ? "2-digit" : "numeric",
  });
  // "octubre de 2026" -> "Octubre de 2026" (CSS `capitalize` pondría también "De").
  return texto.charAt(0).toUpperCase() + texto.slice(1);
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

/** Texto amigable para la fecha de un cobro: "Hoy", "En 3 días", "Atrasado 2 días". */
export function textoVencimiento(fecha: FechaISO): string {
  const dias = diasHasta(fecha);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias < 0) return `Atrasado ${-dias} día${dias === -1 ? "" : "s"}`;
  return `En ${dias} días`;
}
