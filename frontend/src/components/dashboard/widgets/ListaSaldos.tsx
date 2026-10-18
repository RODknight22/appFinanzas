import type { SaldoCuenta } from "../../../types";
import { formatearDinero } from "../../../utils/formato";
import { TIPOS_CUENTA } from "../../formularios/FormularioCuenta";
import { Vacio } from "../../ui/Estados";

export function ListaSaldos({ cuentas }: { cuentas: SaldoCuenta[] }) {
  if (cuentas.length === 0) return <Vacio mensaje="Aún no tienes cuentas" />;
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {cuentas.map((cuenta) => (
        <li key={cuenta.cuenta_id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
          <span className="min-w-0">
            <span className="font-medium">{cuenta.nombre}</span>
            <span className="ml-2 text-xs text-slate-500">{TIPOS_CUENTA[cuenta.tipo].etiqueta}</span>
          </span>
          <span className="text-right">
            <span className={`block font-semibold tabular-nums ${Number(cuenta.saldo) < 0 ? "text-rose-600" : ""}`}>
              {formatearDinero(cuenta.saldo, cuenta.moneda)}
            </span>
            {/* Si la cuenta está en otra divisa, su equivalente en la principal */}
            {cuenta.saldo_principal !== cuenta.saldo && (
              <span className="block text-xs text-slate-500 tabular-nums">≈ {formatearDinero(cuenta.saldo_principal)}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
