import { Check } from "lucide-react";

import { ACENTOS } from "../../config";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import type { ColorAcento } from "../../types";
import { Tarjeta } from "../ui/Tarjeta";
import { avisarError } from "./avisarError";

/** Color de acento: se aplica al instante en toda la app. */
export function SeccionApariencia() {
  const { configuracion, actualizarConfiguracion } = useConfiguracion();

  function elegir(acento: ColorAcento) {
    actualizarConfiguracion({ color_acento: acento }).catch(avisarError);
  }

  return (
    <Tarjeta titulo="Apariencia">
      <fieldset>
        <legend className="mb-3 text-sm text-slate-500">
          Color de acento de botones, menú y enlaces. El modo claro/oscuro está en el menú lateral.
        </legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Object.entries(ACENTOS).map(([valor, { nombre, muestra }]) => {
            const activo = configuracion.color_acento === valor;
            return (
              <button
                key={valor}
                type="button"
                onClick={() => elegir(valor as ColorAcento)}
                aria-pressed={activo}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs transition ${
                  activo ? "border-slate-400 dark:border-slate-500" : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: muestra }}>
                  {activo && <Check size={16} />}
                </span>
                {nombre}
              </button>
            );
          })}
        </div>
      </fieldset>
    </Tarjeta>
  );
}
