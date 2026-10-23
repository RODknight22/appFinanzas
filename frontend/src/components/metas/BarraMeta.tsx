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
          className={`h-full rounded-full transition-all duration-700 ${meta.cumplida ? "bg-exito" : "bg-acento-500"}`}
          style={{ width: `${ancho}%` }}
        />
      </div>
      {/* Marcas de los hitos (25/50/75 %): se ve cuánto falta para la próxima celebración */}
      <div className="relative -mt-2.5 h-2.5" aria-hidden>
        {[25, 50, 75].map((hito) => (
          <span
            key={hito}
            className={`absolute top-0 h-2.5 w-0.5 -translate-x-1/2 rounded-full ${meta.porcentaje >= hito ? "bg-white/60" : "bg-tenue-2/50"}`}
            style={{ left: `${hito}%` }}
          />
        ))}
      </div>
    </div>
  );
}
