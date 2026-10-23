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
  /** La cifra protagonista del panel: fondo en degradado del color de acento. */
  destacada?: boolean;
  /** Valores de los últimos meses (el último es el actual): sparkline y variación. */
  serie?: number[];
  /** En los gastos, subir es malo: la variación se pinta al revés. */
  subirEsMalo?: boolean;
}

/** "▲ 12 %" en verde si la tendencia es buena y en rojo si es mala. */
function Variacion({ serie, subirEsMalo, destacada }: { serie: number[]; subirEsMalo: boolean; destacada: boolean }) {
  const cambio = variacion(serie);
  if (cambio === null || Math.abs(cambio) < 0.05) return null;
  const sube = cambio > 0;
  const buena = sube !== subirEsMalo;
  const Icono = sube ? TrendingUp : TrendingDown;
  const color = destacada
    ? "bg-white/15 text-white"
    : buena
      ? "bg-ingreso/15 text-ingreso"
      : "bg-gasto/15 text-gasto";
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
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-3xl p-4 sm:p-5 ${
        destacada
          ? "bg-linear-to-br from-acento-500 via-acento-700 to-acento-950 text-white"
          : "bg-superficie shadow-[var(--sombra)] ring-1 ring-linea"
      }`}
    >
      {/* Brillo difuso en la esquina: da profundidad sin imágenes */}
      {destacada && <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" />}
      <div className="relative flex items-center justify-between gap-2">
        <p className={`truncate text-sm font-semibold ${destacada ? "text-white/80" : "text-tenue"}`}>{titulo}</p>
        <span className={`shrink-0 rounded-full p-2 ${destacada ? "bg-white/15 text-white" : TONOS[tono]}`}>
          <Icono size={16} />
        </span>
      </div>
      <p className={`relative mt-3 font-bold tracking-tight tabular-nums ${destacada ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}>
        {valor}
      </p>
      <div className="relative mt-1 flex flex-wrap items-center gap-2">
        {serie && <Variacion serie={serie} subirEsMalo={subirEsMalo} destacada={destacada} />}
        {detalle && <p className={`text-xs ${destacada ? "text-white/70" : "text-tenue"}`}>{detalle}</p>}
      </div>
      {/* La sparkline va al fondo: mt-auto la empuja abajo si la tarjeta es más alta */}
      {serie && serie.length > 1 && (
        <div className={`relative mt-auto pt-3 ${destacada ? "text-white/80" : COLOR_SERIE[tono]}`}>
          <Sparkline valores={serie} />
        </div>
      )}
    </div>
  );
}
