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
    // useGrouping "always": en español Intl no separa los miles en números de 4 cifras
    // ("9835,05 €"); en una app de dinero se lee mejor "9.835,05 €".
    existente = new Intl.NumberFormat(localeActual, { style: "currency", currency: moneda, useGrouping: "always" });
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

/** Número sin moneda con el formato regional de la app (p. ej. un tipo de cambio). */
export function formatearNumero(valor: number, maxDecimales = 4): string {
  return valor.toLocaleString(localeActual, { maximumFractionDigits: maxDecimales });
}

/**
 * Las fechas ISO ("2026-10-18") se interpretan en UTC por defecto, lo que puede
 * mostrar el día anterior según la zona horaria. Las construimos en hora local.
 */
export function fechaLocal(fecha: FechaISO): Date {
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

/** Nombre corto de un mes (1-12) con el formato regional de la app: "oct", "Oct"… */
export function nombreMesCorto(mes: number): string {
  return new Date(2000, mes - 1, 1).toLocaleDateString(localeActual, { month: "short" }).replace(".", "");
}

/** Suma días a una fecha ISO (negativo para restar). */
export function sumarDias(fecha: FechaISO, dias: number): FechaISO {
  const resultado = fechaLocal(fecha);
  resultado.setDate(resultado.getDate() + dias);
  return aISO(resultado);
}

/** Fecha de hoy en formato ISO local, para valores por defecto de formularios. */
export function hoyISO(): FechaISO {
  return aISO(new Date());
}

// Día en que empieza el "mes financiero" (lo fija la configuración; 1 = mes natural).
let diaInicioMes = 1;

export function configurarDiaInicioMes(dia: number): void {
  diaInicioMes = dia;
}

export function aISO(fecha: Date): FechaISO {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** El mes financiero en curso: si hoy es 10 y el mes empieza el 15, aún es el anterior. */
export function mesActual(): MesAnio {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - (hoy.getDate() < diaInicioMes ? 1 : 0), 1);
  return aISO(inicio).slice(0, 7);
}

/** Primer y último día de un mes financiero, para filtrar transacciones con desde/hasta. */
export function rangoDelMes(mes: MesAnio): { desde: FechaISO; hasta: FechaISO } {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const desde = new Date(anio, numeroMes - 1, diaInicioMes);
  // Un día antes del inicio del mes siguiente (Date ajusta solo los desbordes de mes y año).
  const hasta = new Date(anio, numeroMes, diaInicioMes - 1);
  return { desde: aISO(desde), hasta: aISO(hasta) };
}

/** "15 oct – 14 nov" si el mes no empieza el día 1; si no, null. */
export function textoRangoMes(mes: MesAnio): string | null {
  if (diaInicioMes === 1) return null;
  const { desde, hasta } = rangoDelMes(mes);
  const corto = (fecha: FechaISO) =>
    fechaLocal(fecha).toLocaleDateString(localeActual, { day: "numeric", month: "short" });
  return `${corto(desde)} – ${corto(hasta)}`;
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
