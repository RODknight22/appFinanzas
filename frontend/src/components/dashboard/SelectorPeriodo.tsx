import { PERIODOS, type Periodo } from "../../utils/periodo";

interface SelectorPeriodoProps {
  periodo: Periodo;
  onCambiar: (periodo: Periodo) => void;
}

/** Control segmentado sobrio: Mes · 3D · 7D · 30D · 3M · 1A. */
export function SelectorPeriodo({ periodo, onCambiar }: SelectorPeriodoProps) {
  return (
    <div role="group" aria-label="Periodo de los datos" className="inline-flex rounded-full bg-superficie-2 p-1 ring-1 ring-linea">
      {PERIODOS.map(({ valor, etiqueta, nombre }) => (
        <button
          key={valor}
          type="button"
          onClick={() => onCambiar(valor)}
          aria-pressed={periodo === valor}
          aria-label={valor === "mes" ? "Por meses" : `Ver ${nombre}`}
          title={valor === "mes" ? "Por meses" : nombre.charAt(0).toUpperCase() + nombre.slice(1)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${
            periodo === valor ? "bg-superficie text-texto shadow-sm ring-1 ring-linea" : "text-tenue hover:text-texto"
          }`}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );
}
