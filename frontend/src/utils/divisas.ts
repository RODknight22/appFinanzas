/**
 * Conversión aproximada en el navegador, solo para vistas previas
 * ("≈ 2,000.00 MXN"). El importe que se guarda lo calcula siempre el backend
 * con la tasa del día de la transacción.
 */
import type { Moneda, Tasa } from "../types";
import { formatearNumero } from "./formato";

/** Valor de 1 unidad de `moneda` en la principal (la principal vale 1). */
function enPrincipal(moneda: Moneda, principal: Moneda, tasas: Tasa[]): number | undefined {
  if (moneda === principal) return 1;
  const tasa = tasas.find((t) => t.moneda === moneda);
  return tasa ? Number(tasa.en_principal) : undefined;
}

/** de → principal → a. Devuelve undefined si falta alguna tasa. */
export function convertir(monto: number, de: Moneda, a: Moneda, principal: Moneda, tasas: Tasa[]): number | undefined {
  if (de === a) return monto;
  const valorDe = enPrincipal(de, principal, tasas);
  const valorA = enPrincipal(a, principal, tasas);
  if (valorDe === undefined || valorA === undefined) return undefined;
  return (monto * valorDe) / valorA;
}

/**
 * Expresa un tipo de cambio siempre con la moneda "fuerte" delante, que es
 * como se lee: "1 EUR = 21.43 MXN" en vez de "1 MXN = 0.0467 EUR".
 * `porUnidad` = cuántas unidades de `a` da 1 unidad de `de`.
 */
export function textoTipoDeCambio(porUnidad: number, de: Moneda, a: Moneda): string {
  const [base, cotizada, valor] = porUnidad >= 1 ? [de, a, porUnidad] : [a, de, 1 / porUnidad];
  return `1 ${base} = ${formatearNumero(valor)} ${cotizada}`;
}
