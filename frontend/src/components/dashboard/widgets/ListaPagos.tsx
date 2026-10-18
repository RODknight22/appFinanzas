import { CalendarClock, CreditCard } from "lucide-react";

import type { PagoProximo } from "../../../utils/cuentas";
import { diasHasta, formatearDinero, formatearFecha, textoVencimiento } from "../../../utils/formato";
import { Vacio } from "../../ui/Estados";

export function ListaPagos({ pagos }: { pagos: PagoProximo[] }) {
  if (pagos.length === 0) return <Vacio mensaje="Nada que pagar en los próximos días" />;
  return (
    <ul className="space-y-3">
      {pagos.map((pago) => (
        <li key={pago.clave} className="flex items-center gap-3 text-sm">
          <span className="rounded-lg bg-slate-100 p-2 text-slate-500 dark:bg-slate-800">
            {pago.origen === "tarjeta" ? <CreditCard size={16} /> : <CalendarClock size={16} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{pago.nombre}</span>
            <span className={`text-xs ${diasHasta(pago.fecha) < 0 ? "text-rose-600" : "text-slate-500"}`}>
              {textoVencimiento(pago.fecha)} · {formatearFecha(pago.fecha)}
            </span>
          </span>
          <span className="font-medium tabular-nums">{formatearDinero(pago.monto, pago.moneda)}</span>
        </li>
      ))}
    </ul>
  );
}
