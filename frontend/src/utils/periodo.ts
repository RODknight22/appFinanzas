/** Periodo de los datos del dashboard: el mes elegido o los últimos días hasta hoy. */
import type { FechaISO, MesAnio, RangoFechas } from "../types";
import { aISO, fechaLocal, formatearMesEnFrase, hoyISO, sumarDias } from "./formato";

export type Periodo = "mes" | "3d" | "7d" | "30d" | "3m" | "1a";

interface OpcionPeriodo {
  valor: Periodo;
  /** Corta, para el control segmentado (cabe en un móvil). */
  etiqueta: string;
  /** En mitad de una frase: "Gastos de los últimos 7 días". */
  nombre: string;
}

export const PERIODOS: OpcionPeriodo[] = [
  { valor: "mes", etiqueta: "Mes", nombre: "el mes elegido" },
  { valor: "3d", etiqueta: "3D", nombre: "los últimos 3 días" },
  { valor: "7d", etiqueta: "7D", nombre: "los últimos 7 días" },
  { valor: "30d", etiqueta: "30D", nombre: "los últimos 30 días" },
  { valor: "3m", etiqueta: "3M", nombre: "los últimos 3 meses" },
  { valor: "1a", etiqueta: "1A", nombre: "el último año" },
];

export function esPeriodo(valor: unknown): valor is Periodo {
  return PERIODOS.some((p) => p.valor === valor);
}

/** Resta meses a una fecha sin pasarse de fin de mes (31 may − 3 meses = 28 o 29 feb). */
function restarMeses(fecha: FechaISO, meses: number): FechaISO {
  const original = fechaLocal(fecha);
  const resultado = new Date(original.getFullYear(), original.getMonth() - meses, 1);
  const ultimoDia = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
  resultado.setDate(Math.min(original.getDate(), ultimoDia));
  return aISO(resultado);
}

/**
 * Los días que abarca el periodo, hoy incluido; null en "mes" (el backend usa el mes).
 * "7 días" son hoy y los 6 anteriores; "3 meses", desde el día siguiente a hoy hace 3 meses.
 */
export function rangoPeriodo(periodo: Periodo, hoy: FechaISO = hoyISO()): RangoFechas | null {
  switch (periodo) {
    case "mes":
      return null;
    case "3d":
      return { desde: sumarDias(hoy, -2), hasta: hoy };
    case "7d":
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case "30d":
      return { desde: sumarDias(hoy, -29), hasta: hoy };
    case "3m":
      return { desde: sumarDias(restarMeses(hoy, 3), 1), hasta: hoy };
    case "1a":
      return { desde: sumarDias(restarMeses(hoy, 12), 1), hasta: hoy };
  }
}

/** "octubre de 2026" o "los últimos 7 días": para títulos y frases de los widgets. */
export function textoPeriodo(periodo: Periodo, mes: MesAnio): string {
  if (periodo === "mes") return formatearMesEnFrase(mes);
  return PERIODOS.find((p) => p.valor === periodo)?.nombre ?? "";
}
