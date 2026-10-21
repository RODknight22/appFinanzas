import { HandCoins } from "lucide-react";

import type { IngresoRecurrente } from "../../../types";
import { diasHasta, formatearDinero, formatearFecha, textoVencimiento } from "../../../utils/formato";
import { Vacio } from "../../ui/Estados";

export function ListaCobros({ cobros }: { cobros: IngresoRecurrente[] }) {
  if (cobros.length === 0) return <Vacio mensaje="No esperas ingresos fijos en los próximos días" />;
  return (
    <ul className="space-y-3">
      {cobros.map((cobro) => (
        <li key={cobro.id} className="flex items-center gap-3 text-sm">
          <span className="rounded-lg bg-superficie-2 p-2 text-tenue">
            <HandCoins size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{cobro.nombre}</span>
            {/* Atrasado: debería haber llegado (o falta marcarlo como cobrado). */}
            <span className={`text-xs ${diasHasta(cobro.fecha_proximo_cobro) < 0 ? "text-amber-600" : "text-tenue"}`}>
              {textoVencimiento(cobro.fecha_proximo_cobro)} · {formatearFecha(cobro.fecha_proximo_cobro)}
            </span>
          </span>
          <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
            +{formatearDinero(cobro.monto, cobro.moneda)}
          </span>
        </li>
      ))}
    </ul>
  );
}
