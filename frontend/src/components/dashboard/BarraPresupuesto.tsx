import type { ProgresoPresupuesto } from "../../types";
import { formatearDinero, formatearPorcentaje } from "../../utils/formato";

/** Verde hasta el 75 %, ámbar hasta el 100 % y rojo si se excede. */
function colorBarra(porcentaje: number): string {
  if (porcentaje > 100) return "bg-rose-500";
  if (porcentaje >= 75) return "bg-amber-500";
  return "bg-emerald-500";
}

/** Barra de progreso de un presupuesto: cuánto se ha gastado del límite. */
export function BarraPresupuesto({ progreso }: { progreso: ProgresoPresupuesto }) {
  // La barra no puede pasar del 100 % de ancho aunque el gasto lo supere.
  const ancho = Math.min(progreso.porcentaje, 100);
  const restante = Number(progreso.restante);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: progreso.color }} />
          {progreso.nombre}
        </span>
        <span className="tabular-nums text-tenue">
          {formatearDinero(progreso.gastado, progreso.moneda)} / {formatearDinero(progreso.monto_limite, progreso.moneda)}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-superficie-2"
        role="progressbar"
        aria-valuenow={progreso.porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Presupuesto de ${progreso.nombre}`}
      >
        <div className={`h-full rounded-full transition-all ${colorBarra(progreso.porcentaje)}`} style={{ width: `${ancho}%` }} />
      </div>
      <p className={`mt-1 text-xs ${progreso.excedido ? "text-rose-600 dark:text-rose-400" : "text-tenue"}`}>
        {progreso.excedido
          ? `Excedido en ${formatearDinero(-restante, progreso.moneda)} (${formatearPorcentaje(progreso.porcentaje)})`
          : `Quedan ${formatearDinero(restante, progreso.moneda)} (${formatearPorcentaje(progreso.porcentaje)} usado)`}
      </p>
    </div>
  );
}
