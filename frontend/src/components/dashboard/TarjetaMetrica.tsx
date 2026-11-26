import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { formatearPorcentaje } from "../../utils/formato";
import { variacion } from "../../utils/tendencias";
import { Sparkline } from "../ui/Sparkline";

type Tono = "neutral" | "positivo" | "negativo";

const TONOS: Record<Tono, string> = {
  neutral: "bg-superficie-2 text-suave",
  positivo: "bg-ingreso/15 text-ingreso",
  negativo: "bg-gasto/15 text-gasto",
};

const COLOR_SERIE: Record<Tono, string> = {
  neutral: "text-acento-500",
  positivo: "text-ingreso",
  negativo: "text-gasto",
};

interface TarjetaMetricaProps {
  titulo: string;
  valor: string;
  icono: LucideIcon;
  tono?: Tono;
  detalle?: string;
  /** La cifra protagonista del panel: más grande, con icono y línea en el color de acento.
   *  Sin degradado ni brillo: la marca usa colores sólidos y bordes. */
  destacada?: boolean;
  /** Valores de los últimos meses (el último es el actual): sparkline y variación. */
  serie?: number[];
  /** En los gastos, subir es malo: la variación se pinta al revés. */
  subirEsMalo?: boolean;
}

/** "▲ 12 %" en verde si la tendencia es buena y en rojo si es mala. */
function Variacion({ serie, subirEsMalo }: { serie: number[]; subirEsMalo: boolean }) {
  const cambio = variacion(serie);
  if (cambio === null || Math.abs(cambio) < 0.05) return null;
  const sube = cambio > 0;
  const buena = sube !== subirEsMalo;
  const Icono = sube ? TrendingUp : TrendingDown;
  const color = buena ? "bg-ingreso/15 text-ingreso" : "bg-gasto/15 text-gasto";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${color}`} title="Respecto al mes anterior">
      <Icono size={12} /> {formatearPorcentaje(Math.abs(cambio))}
    </span>
  );
}

/** Un número destacado del dashboard (balance, ingresos, gastos…). */
export function TarjetaMetrica({
  titulo,
  valor,
  icono: Icono,
  tono = "neutral",
  detalle,
  destacada = false,
  serie,
  subirEsMalo = false,
}: TarjetaMetricaProps) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-superficie p-4 shadow-[var(--sombra)] ring-1 ring-linea sm:p-5">
      <div className="relative flex items-center justify-between gap-2">
        <p className={`truncate text-sm font-semibold text-tenue`}>{titulo}</p>
        <span className={`shrink-0 rounded-full p-2 ${destacada ? "bg-acento-500/15 text-acento-600 dark:text-acento-400" : TONOS[tono]}`}>
          <Icono size={16} />
        </span>
      </div>
      <p className={`relative mt-3 font-bold tracking-tight tabular-nums ${destacada ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}>
        {valor}
      </p>
      <div className="relative mt-1 flex flex-wrap items-center gap-2">
        {serie && <Variacion serie={serie} subirEsMalo={subirEsMalo} />}
        {detalle && <p className="text-xs text-tenue">{detalle}</p>}
      </div>
      {/* La sparkline va al fondo: mt-auto la empuja abajo si la tarjeta es más alta */}
      {serie && serie.length > 1 && (
        <div className={`relative mt-auto pt-3 ${destacada ? "text-acento-500" : COLOR_SERIE[tono]}`}>
          <Sparkline valores={serie} />
        </div>
      )}
    </div>
  );
}
