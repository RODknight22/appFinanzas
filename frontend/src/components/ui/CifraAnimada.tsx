import { useCifraAnimada } from "../../hooks/useCifraAnimada";
import type { Dinero, Moneda } from "../../types";
import { formatearDinero } from "../../utils/formato";

interface CifraAnimadaProps {
  valor: Dinero;
  /** Por defecto, la moneda principal (como formatearDinero). */
  moneda?: Moneda;
}

/**
 * Un importe que "cuenta" hasta su valor al aparecer (~0,6 s). Al terminar muestra exactamente
 * formatearDinero(valor): la animación nunca cambia la cifra final.
 */
export function CifraAnimada({ valor, moneda }: CifraAnimadaProps) {
  const intermedio = useCifraAnimada(Number(valor));
  return <>{formatearDinero(intermedio ?? valor, moneda)}</>;
}
