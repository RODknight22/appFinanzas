import { ArrowRight, ArrowRightLeft } from "lucide-react";

import type { Cuenta, Transferencia } from "../../types";
import { formatearDinero, formatearFecha } from "../../utils/formato";
import { AccionesFila } from "../ui/AccionesFila";
import { Vacio } from "../ui/Estados";

interface ListaTransferenciasProps {
  transferencias: Transferencia[];
  cuentas: Cuenta[];
  onEditar: (transferencia: Transferencia) => void;
  onEliminar: (transferencia: Transferencia) => void;
}

/** "Banco → Revolut", con lo que salió y, si cambió de moneda, lo que llegó. */
export function ListaTransferencias({ transferencias, cuentas, onEditar, onEliminar }: ListaTransferenciasProps) {
  if (transferencias.length === 0) {
    return <Vacio mensaje="Aún no hay transferencias. Úsalas para mover dinero entre tus cuentas o pagar una tarjeta." />;
  }
  const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));

  return (
    <ul className="divide-y divide-linea">
      {transferencias.map((t) => {
        const origen = cuentaPorId.get(t.cuenta_origen_id);
        const destino = cuentaPorId.get(t.cuenta_destino_id);
        const cambioDeMoneda = origen && destino && origen.moneda !== destino.moneda;
        return (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <span className="rounded-xl bg-acento-50 p-2 text-acento-600 dark:bg-acento-950 dark:text-acento-400">
              <ArrowRightLeft size={18} />
            </span>
            {/* Sin truncar: en móvil hay poco ancho y "Banc… → V…" no se entendería; mejor que salte de línea */}
            <div className="min-w-0 flex-1 break-words">
              <p className="font-medium">
                {origen?.nombre}
                <ArrowRight size={14} className="mx-1 inline text-tenue-2" aria-label="a" />
                {destino?.nombre}
              </p>
              <p className="text-xs text-tenue">
                {formatearFecha(t.fecha)}
                {t.comision && origen && ` · comisión ${formatearDinero(t.comision, origen.moneda)}`}
                {t.notas && ` · ${t.notas}`}
              </p>
            </div>
            <span className="text-right tabular-nums">
              <span className="block font-semibold">{origen && formatearDinero(t.monto_origen, origen.moneda)}</span>
              {cambioDeMoneda && t.monto_destino && (
                <span className="block text-xs text-tenue">→ {formatearDinero(t.monto_destino, destino.moneda)}</span>
              )}
            </span>
            <AccionesFila onEditar={() => onEditar(t)} onEliminar={() => onEliminar(t)} />
          </li>
        );
      })}
    </ul>
  );
}
