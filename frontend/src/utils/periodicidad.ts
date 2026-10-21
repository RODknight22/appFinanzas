/** Textos y cálculos de los ingresos recurrentes con calendario flexible. */
import { COBROS_POR_MES, PERIODICIDADES } from "../config";
import type { IngresoRecurrente, Periodicidad } from "../types";

/** Un día 31 significa "el último del mes" (igual que en el backend). */
export const ULTIMO_DIA = 31;

/** Unidad de cada periodicidad para "cada N …" (singular, plural). La quincenal no tiene intervalo. */
export const UNIDADES: Record<Exclude<Periodicidad, "quincenal">, [string, string]> = {
  diaria: ["día", "días"],
  semanal: ["semana", "semanas"],
  mensual: ["mes", "meses"],
  anual: ["año", "años"],
};

type Calendario = Pick<IngresoRecurrente, "periodicidad" | "intervalo" | "dia_quincena_1" | "dia_quincena_2" | "dia_del_mes" | "adelantar_a_habil">;

export function textoDia(dia: number): string {
  return dia >= ULTIMO_DIA ? "último" : String(dia);
}

/** "Cada 2 semanas", "Quincenal (1 y 16)", "Mensual, el último día · día hábil"… */
export function describirPeriodicidad(ingreso: Calendario): string {
  const { periodicidad } = ingreso;
  let texto: string;
  if (periodicidad === "quincenal") {
    const dias = ingreso.dia_quincena_1 && ingreso.dia_quincena_2 ? [ingreso.dia_quincena_1, ingreso.dia_quincena_2] : [15, ULTIMO_DIA];
    texto = `Quincenal (${textoDia(dias[0])} y ${textoDia(dias[1])})`;
  } else {
    const n = ingreso.intervalo ?? 1;
    texto = n > 1 ? `Cada ${n} ${UNIDADES[periodicidad][1]}` : PERIODICIDADES[periodicidad];
    if (periodicidad === "mensual" && ingreso.dia_del_mes) {
      texto += ingreso.dia_del_mes >= ULTIMO_DIA ? ", el último día" : `, el día ${ingreso.dia_del_mes}`;
    }
  }
  return ingreso.adelantar_a_habil ? `${texto} · día hábil` : texto;
}

/** Cobros al mes en promedio, teniendo en cuenta el intervalo (cada 2 meses = 0,5). */
export function cobrosPorMes(ingreso: Calendario): number {
  const intervalo = ingreso.periodicidad === "quincenal" ? 1 : (ingreso.intervalo ?? 1);
  return COBROS_POR_MES[ingreso.periodicidad] / intervalo;
}
