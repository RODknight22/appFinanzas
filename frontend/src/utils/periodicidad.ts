/** Textos y cálculos de los fijos (ingresos y pagos) con calendario flexible. */
import { COBROS_POR_MES, PERIODICIDADES } from "../config";
import type { CalendarioFijo, Periodicidad } from "../types";

/** Un día 31 significa "el último del mes" (igual que en el backend). */
export const ULTIMO_DIA = 31;
/** Como mucho tantos días en "varias veces al mes" (igual que MAX_DIAS_DE_COBRO en el backend). */
export const MAX_DIAS_DE_COBRO = 10;

/** Periodicidades sin "cada N": las que van por días concretos del mes. */
type PorDiasDelMes = "quincenal" | "varias_al_mes";

/** Unidad de cada periodicidad para "cada N …" (singular, plural). */
export const UNIDADES: Record<Exclude<Periodicidad, PorDiasDelMes>, [string, string]> = {
  diaria: ["día", "días"],
  semanal: ["semana", "semanas"],
  mensual: ["mes", "meses"],
  anual: ["año", "años"],
};

export function esPorDiasDelMes(periodicidad: Periodicidad): periodicidad is PorDiasDelMes {
  return periodicidad === "quincenal" || periodicidad === "varias_al_mes";
}

type Calendario = Pick<
  CalendarioFijo,
  "periodicidad" | "intervalo" | "dia_quincena_1" | "dia_quincena_2" | "dia_del_mes" | "dias_de_cobro" | "adelantar_a_habil"
>;

export function textoDia(dia: number): string {
  return dia >= ULTIMO_DIA ? "último" : String(dia);
}

/** [10, 20, 31] → "10, 20 y último". */
export function listaDeDias(dias: number[]): string {
  const textos = dias.map(textoDia);
  return textos.length > 1 ? `${textos.slice(0, -1).join(", ")} y ${textos[textos.length - 1]}` : (textos[0] ?? "");
}

/** "Los días 10, 20 y 30", "El día 5 de cada mes", "El último día de cada mes". */
function describirDias(dias: number[]): string {
  if (dias.length === 1) return dias[0] >= ULTIMO_DIA ? "El último día de cada mes" : `El día ${dias[0]} de cada mes`;
  return `Los días ${listaDeDias(dias)}`;
}

/** "Cada 2 semanas", "Quincenal (1 y 16)", "Los días 10, 20 y 30", "Mensual, el último día · día hábil"… */
export function describirPeriodicidad(fijo: Calendario): string {
  const { periodicidad } = fijo;
  let texto: string;
  if (periodicidad === "quincenal") {
    const dias = fijo.dia_quincena_1 && fijo.dia_quincena_2 ? [fijo.dia_quincena_1, fijo.dia_quincena_2] : [15, ULTIMO_DIA];
    texto = `Quincenal (${listaDeDias(dias)})`;
  } else if (periodicidad === "varias_al_mes") {
    texto = fijo.dias_de_cobro?.length ? describirDias(fijo.dias_de_cobro) : PERIODICIDADES.varias_al_mes;
  } else {
    const n = fijo.intervalo ?? 1;
    texto = n > 1 ? `Cada ${n} ${UNIDADES[periodicidad][1]}` : PERIODICIDADES[periodicidad];
    if (periodicidad === "mensual" && fijo.dia_del_mes) {
      texto += fijo.dia_del_mes >= ULTIMO_DIA ? ", el último día" : `, el día ${fijo.dia_del_mes}`;
    }
  }
  return fijo.adelantar_a_habil ? `${texto} · día hábil` : texto;
}

/** Cobros al mes en promedio, teniendo en cuenta el intervalo (cada 2 meses = 0,5) y los días elegidos. */
export function cobrosPorMes(fijo: Calendario): number {
  if (fijo.periodicidad === "varias_al_mes") return fijo.dias_de_cobro?.length || 1;
  const intervalo = fijo.periodicidad === "quincenal" ? 1 : (fijo.intervalo ?? 1);
  return COBROS_POR_MES[fijo.periodicidad] / intervalo;
}
