import type { LucideIcon } from "lucide-react";

type Tono = "neutral" | "positivo" | "negativo";

const TONOS: Record<Tono, string> = {
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  positivo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  negativo: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
};

interface TarjetaMetricaProps {
  titulo: string;
  valor: string;
  icono: LucideIcon;
  tono?: Tono;
  detalle?: string;
}

/** Un número destacado del dashboard (balance, ingresos, gastos…). */
export function TarjetaMetrica({ titulo, valor, icono: Icono, tono = "neutral", detalle }: TarjetaMetricaProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{titulo}</p>
        <span className={`rounded-lg p-2 ${TONOS[tono]}`}>
          <Icono size={16} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}
