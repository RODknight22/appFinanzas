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

/** Total de varios importes pasados a la principal. `faltan`: monedas sin tasa (sus importes no suman). */
export interface SumaConvertida {
  total: number;
  faltan: Moneda[];
  /** Cuántos importes sí se pudieron convertir (0 con `faltan` = no hay total que mostrar). */
  convertidos: number;
}

/**
 * Suma importes en distintas monedas. Si falta la tasa de alguna, no la cuenta como 0
 * en silencio: la apunta en `faltan` para que la pantalla avise de que el total es parcial.
 */
export function sumarConvertidos(
  partes: { monto: number; moneda: Moneda }[],
  convertirAPrincipal: (monto: number, de: Moneda) => number | undefined,
): SumaConvertida {
  const suma: SumaConvertida = { total: 0, faltan: [], convertidos: 0 };
  for (const { monto, moneda } of partes) {
    const convertido = convertirAPrincipal(monto, moneda);
    if (convertido === undefined) {
      if (!suma.faltan.includes(moneda)) suma.faltan.push(moneda);
    } else {
      suma.total += convertido;
      suma.convertidos++;
    }
  }
  return suma;
}
