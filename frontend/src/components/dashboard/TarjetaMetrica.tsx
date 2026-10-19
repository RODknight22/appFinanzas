import type { LucideIcon } from "lucide-react";

type Tono = "neutral" | "positivo" | "negativo";

const TONOS: Record<Tono, string> = {
  neutral: "bg-superficie-2 text-suave",
  positivo: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  negativo: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

interface TarjetaMetricaProps {
  titulo: string;
  valor: string;
  icono: LucideIcon;
  tono?: Tono;
  detalle?: string;
  /** La cifra protagonista del panel: fondo en degradado del color de acento. */
  destacada?: boolean;
}

/** Un número destacado del dashboard (balance, ingresos, gastos…). */
export function TarjetaMetrica({ titulo, valor, icono: Icono, tono = "neutral", detalle, destacada = false }: TarjetaMetricaProps) {
  return (
    <div
      className={`relative h-full overflow-hidden rounded-3xl p-5 ${
        destacada
          ? "bg-linear-to-br from-acento-500 via-acento-700 to-acento-950 text-white"
          : "bg-superficie shadow-[var(--sombra)] ring-1 ring-linea"
      }`}
    >
      {/* Brillo difuso en la esquina: da profundidad sin imágenes */}
      {destacada && <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" />}
      <div className="relative flex items-center justify-between">
        <p className={`text-sm font-semibold ${destacada ? "text-white/80" : "text-tenue"}`}>{titulo}</p>
        <span className={`rounded-full p-2 ${destacada ? "bg-white/15 text-white" : TONOS[tono]}`}>
          <Icono size={16} />
        </span>
      </div>
      <p className="relative mt-4 text-3xl font-bold tracking-tight tabular-nums">{valor}</p>
      {detalle && <p className={`relative mt-1 text-xs ${destacada ? "text-white/70" : "text-tenue"}`}>{detalle}</p>}
    </div>
  );
}
