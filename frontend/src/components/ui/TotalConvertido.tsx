import type { SumaConvertida } from "../../utils/divisas";
import { formatearDinero } from "../../utils/formato";

/**
 * Muestra un total en la moneda principal. Si faltó la tasa de alguna moneda,
 * lo marca con "≈" (es parcial) y explica cuál falta; si no se pudo convertir nada, "—".
 * `factor` escala el total (p. ej. ×12 para pasar de mensual a anual).
 */
export function TotalConvertido({ suma, factor = 1 }: { suma: SumaConvertida; factor?: number }) {
  if (suma.faltan.length === 0) return <>{formatearDinero(suma.total * factor)}</>;
  const aviso = `Falta la tasa de ${suma.faltan.join(", ")}: esos importes no están sumados`;
  if (suma.convertidos === 0) return <span title={aviso}>—</span>;
  return <span title={aviso}>≈ {formatearDinero(suma.total * factor)}</span>;
}
