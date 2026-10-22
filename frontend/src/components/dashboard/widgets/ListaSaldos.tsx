import { Pin } from "lucide-react";

import type { SaldoCuenta } from "../../../types";
import { formatearDinero } from "../../../utils/formato";
import { TIPOS_CUENTA } from "../../formularios/FormularioCuenta";
import { Vacio } from "../../ui/Estados";

/** Saldos del panel: si hay cuentas fijadas, solo esas; si no, todas. */
export function ListaSaldos({ cuentas }: { cuentas: SaldoCuenta[] }) {
  if (cuentas.length === 0) return <Vacio mensaje="Aún no tienes cuentas" />;
  const fijadas = cuentas.filter((c) => c.fijada);
  const visibles = fijadas.length > 0 ? fijadas : cuentas;
  const ocultas = cuentas.length - visibles.length;
  return (
    <>
      <ul className="divide-y divide-linea">
        {visibles.map((cuenta) => (
          <li key={cuenta.cuenta_id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
            <span className="min-w-0">
              {cuenta.fijada && <Pin size={12} className="mr-1.5 inline fill-current text-acento-600 dark:text-acento-400" aria-label="Fijada" />}
              <span className="font-medium">{cuenta.nombre}</span>
              <span className="ml-2 text-xs text-tenue">{TIPOS_CUENTA[cuenta.tipo].etiqueta}</span>
            </span>
            <span className="text-right">
              <span className={`block font-semibold tabular-nums ${Number(cuenta.saldo) < 0 ? "text-rose-600" : ""}`}>
                {formatearDinero(cuenta.saldo, cuenta.moneda)}
              </span>
              {/* Si la cuenta está en otra divisa, su equivalente en la principal */}
              {cuenta.saldo_principal !== cuenta.saldo && (
                <span className="block text-xs text-tenue tabular-nums">≈ {formatearDinero(cuenta.saldo_principal)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {ocultas > 0 && (
        <p className="pt-2 text-xs text-tenue">
          Solo las fijadas · {ocultas} {ocultas === 1 ? "cuenta más" : "cuentas más"} en Cuentas
        </p>
      )}
    </>
  );
}
