import { Coins } from "lucide-react";

import { MONEDAS } from "../config";
import { useConfiguracion } from "../hooks/useConfiguracion";
import type { Moneda } from "../types";

/** Desplegable para elegir la moneda con la que se muestran todos los importes. */
export function SelectorMoneda({ compacto = false }: { compacto?: boolean }) {
  const { moneda, cambiarMoneda } = useConfiguracion();

  async function alCambiar(nueva: Moneda) {
    try {
      await cambiarMoneda(nueva);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <label className={`flex items-center gap-3 rounded-lg text-sm text-slate-600 dark:text-slate-400 ${compacto ? "" : "px-3 py-2"}`}>
      {!compacto && <Coins size={18} className="shrink-0" />}
      <span className="sr-only">Moneda</span>
      <select
        value={moneda}
        onChange={(e) => alCambiar(e.target.value as Moneda)}
        className="w-full cursor-pointer rounded-md border border-slate-200 bg-transparent px-2 py-1 text-sm font-medium dark:border-slate-700 dark:bg-slate-900"
      >
        {Object.entries(MONEDAS).map(([codigo, { nombre }]) => (
          <option key={codigo} value={codigo}>
            {compacto ? codigo : `${codigo} · ${nombre}`}
          </option>
        ))}
      </select>
    </label>
  );
}
