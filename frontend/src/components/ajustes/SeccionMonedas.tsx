import { MONEDAS } from "../../config";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import type { Moneda } from "../../types";
import { Tarjeta } from "../ui/Tarjeta";
import { avisarError } from "./avisarError";

const TODAS = Object.keys(MONEDAS) as Moneda[];

/** Activar/desactivar monedas y elegir la principal. */
export function SeccionMonedas() {
  const { moneda, monedasActivas, actualizarConfiguracion } = useConfiguracion();

  async function alternarActiva(codigo: Moneda) {
    const activas = monedasActivas.includes(codigo)
      ? monedasActivas.filter((m) => m !== codigo)
      : [...monedasActivas, codigo];
    await actualizarConfiguracion({ monedas_activas: activas }).catch(avisarError);
  }

  async function elegirPrincipal(codigo: Moneda) {
    const aviso =
      `¿Usar ${codigo} como moneda principal?\n\n` +
      "Los totales, gráficos y presupuestos pasarán a mostrarse en esta moneda. " +
      "Cada transacción se reconvertirá con la tasa de su fecha.";
    if (!window.confirm(aviso)) return;
    await actualizarConfiguracion({ moneda: codigo }).catch(avisarError);
  }

  return (
    <Tarjeta titulo="Monedas activas">
      <p className="mb-4 text-sm text-tenue">
        Las monedas activas aparecen en los formularios. La principal es en la que se suman los totales.
      </p>
      <ul className="divide-y divide-linea">
        {TODAS.map((codigo) => {
          const activa = monedasActivas.includes(codigo);
          const esPrincipal = codigo === moneda;
          return (
            <li key={codigo} className="flex items-center gap-4 py-3">
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-acento-600"
                  checked={activa}
                  // La principal no se puede desactivar (el backend también lo impide).
                  disabled={esPrincipal}
                  onChange={() => alternarActiva(codigo)}
                />
                <span className="w-12 font-mono text-sm font-semibold">{codigo}</span>
                <span className="text-sm text-suave">{MONEDAS[codigo].nombre}</span>
              </label>
              {esPrincipal ? (
                <span className="rounded-full bg-acento-100 px-2.5 py-0.5 text-xs font-medium text-acento-700 dark:bg-acento-950 dark:text-acento-300">
                  Principal
                </span>
              ) : (
                activa && (
                  <button type="button" onClick={() => elegirPrincipal(codigo)} className="text-xs font-medium text-acento-600 hover:underline">
                    Hacer principal
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}
