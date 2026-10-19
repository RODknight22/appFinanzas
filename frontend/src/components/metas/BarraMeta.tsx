import type { Meta } from "../../types";
import { formatearDinero } from "../../utils/formato";

/** "🎯 Viaje   EUR 250 / EUR 1,000" + barra. La usan la página de Metas y el widget. */
export function BarraMeta({ meta, conNombre = false }: { meta: Meta; conNombre?: boolean }) {
  // Puede pasar del 100 % (ahorraste de más), pero la barra no sale de su caja.
  const ancho = Math.min(meta.porcentaje, 100);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className={`flex min-w-0 items-center gap-2 font-medium ${conNombre ? "" : "sr-only"}`}>
          <span aria-hidden>{meta.icono}</span>
          <span className="truncate">{meta.nombre}</span>
        </span>
        {/* ml-auto: sin el nombre visible, el importe sigue a la derecha */}
        <span className="ml-auto shrink-0 tabular-nums text-tenue">
          {formatearDinero(meta.ahorrado, meta.moneda)} / {formatearDinero(meta.monto_objetivo, meta.moneda)}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-superficie-2"
        role="progressbar"
        aria-valuenow={meta.porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso de ${meta.nombre}`}
      >
        <div
          className={`h-full rounded-full transition-all ${meta.cumplida ? "bg-emerald-500" : "bg-acento-500"}`}
          style={{ width: `${ancho}%` }}
        />
      </div>
    </div>
  );
}
