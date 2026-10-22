import { Lightbulb } from "lucide-react";
import { useState } from "react";

import { useConfiguracion } from "../../hooks/useConfiguracion";

interface ConsejoProps {
  texto: string;
  /** Hacia dónde se abre el globo: "fin" para iconos pegados al borde derecho. */
  alinear?: "inicio" | "fin";
}

const ALINEACION = { inicio: "left-0", fin: "right-0" };

/**
 * Bombilla con un consejo breve. Se abre al pasar el ratón, con el teclado o con
 * un toque (móvil). Desaparece si se desactivan los consejos en Ajustes.
 */
export function Consejo({ texto, alinear = "inicio" }: ConsejoProps) {
  const { configuracion } = useConfiguracion();
  const [abierto, setAbierto] = useState(false);
  if (!configuracion.mostrar_consejos) return null;

  return (
    <span className="relative inline-flex align-middle" onMouseEnter={() => setAbierto(true)} onMouseLeave={() => setAbierto(false)}>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        aria-label="Consejo"
        aria-expanded={abierto}
        className="rounded-full p-1 text-amber-500 transition-colors hover:bg-realce"
      >
        <Lightbulb size={16} />
      </button>
      {abierto && (
        <span
          role="tooltip"
          className={`absolute top-full z-40 mt-1.5 w-64 max-w-[80vw] animate-entrada rounded-xl bg-superficie p-3 text-left text-xs leading-relaxed font-normal tracking-normal text-suave shadow-2xl ring-1 ring-linea ${ALINEACION[alinear]}`}
        >
          {texto}
        </span>
      )}
    </span>
  );
}
