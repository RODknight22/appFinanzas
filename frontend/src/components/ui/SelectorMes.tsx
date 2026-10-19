import { ChevronLeft, ChevronRight } from "lucide-react";

import type { MesAnio } from "../../types";
import { formatearMes, textoRangoMes } from "../../utils/formato";

/** Suma (o resta) meses a un "YYYY-MM". */
function desplazarMes(mes: MesAnio, delta: number): MesAnio {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const fecha = new Date(anio, numeroMes - 1 + delta, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

interface SelectorMesProps {
  mes: MesAnio;
  onCambiar: (mes: MesAnio) => void;
}

/** Flechas ‹ › para moverse entre meses. */
export function SelectorMes({ mes, onCambiar }: SelectorMesProps) {
  const rango = textoRangoMes(mes);
  const claseFlecha =
    "rounded-full p-1.5 text-tenue hover:bg-realce hover:text-texto";
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-superficie-2 px-1 py-1 ring-1 ring-linea">
      <button type="button" className={claseFlecha} onClick={() => onCambiar(desplazarMes(mes, -1))} aria-label="Mes anterior">
        <ChevronLeft size={18} />
      </button>
      <span className="min-w-36 text-center">
        <span className="block text-sm font-medium">{formatearMes(mes)}</span>
        {/* Con un mes financiero (p. ej. del 15 al 14) mostramos las fechas reales */}
        {rango && <span className="block text-[11px] leading-tight text-tenue">{rango}</span>}
      </span>
      <button type="button" className={claseFlecha} onClick={() => onCambiar(desplazarMes(mes, 1))} aria-label="Mes siguiente">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
