/**
 * Conversión aproximada en el navegador, solo para vistas previas
 * ("≈ 2,000.00 MXN"). El importe que se guarda lo calcula siempre el backend
 * con la tasa del día de la transacción.
 */
import type { Moneda, Tasa } from "../types";

/** Unidades de `moneda` por 1 USD, o undefined si no hay tasa. */
function porUsd(moneda: Moneda, tasas: Tasa[]): number | undefined {
  if (moneda === "USD") return 1;
  const tasa = tasas.find((t) => t.moneda === moneda);
  return tasa ? Number(tasa.por_usd) : undefined;
}

/** Igual que en el backend: de → USD → a. Devuelve undefined si falta alguna tasa. */
export function convertir(monto: number, de: Moneda, a: Moneda, tasas: Tasa[]): number | undefined {
  if (de === a) return monto;
  const tasaDe = porUsd(de, tasas);
  const tasaA = porUsd(a, tasas);
  if (tasaDe === undefined || tasaA === undefined) return undefined;
  return (monto / tasaDe) * tasaA;
}
