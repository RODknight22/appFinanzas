import { MONEDAS } from "../../config";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import type { Moneda } from "../../types";
import { CLASE_ENTRADA_BASE } from "./Campo";

interface SelectMonedaProps {
  valor: Moneda;
  onCambiar: (moneda: Moneda) => void;
  className?: string;
  etiqueta?: string;
  /** Solo el código ("EUR"), para huecos estrechos junto a un importe. */
  compacta?: boolean;
}

/**
 * Desplegable con las monedas activas. Si el registro que se edita usa una
 * moneda ya desactivada, también se muestra para no perder el valor.
 */
export function SelectMoneda({ valor, onCambiar, className = "w-full", etiqueta, compacta = false }: SelectMonedaProps) {
  const { monedasActivas } = useConfiguracion();
  const opciones = monedasActivas.includes(valor) ? monedasActivas : [valor, ...monedasActivas];
  return (
    <select
      className={`${CLASE_ENTRADA_BASE} ${className}`}
      value={valor}
      onChange={(e) => onCambiar(e.target.value as Moneda)}
      aria-label={etiqueta}
    >
      {opciones.map((codigo) => (
        <option key={codigo} value={codigo}>
          {compacta ? codigo : `${codigo} · ${MONEDAS[codigo].nombre}`}
        </option>
      ))}
    </select>
  );
}
