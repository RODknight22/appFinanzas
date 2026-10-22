import { Check } from "lucide-react";

import { ACENTOS, ESTILOS } from "../../config";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import type { ColorAcento, Configuracion, EstiloVisual } from "../../types";
import { Tarjeta } from "../ui/Tarjeta";
import { avisarError } from "./avisarError";

/** Estilo visual y color de acento: se aplican al instante en toda la app. */
export function SeccionApariencia() {
  const { configuracion, actualizarConfiguracion } = useConfiguracion();

  function elegir(cambios: Partial<Configuracion>) {
    actualizarConfiguracion(cambios).catch(avisarError);
  }

  return (
    <Tarjeta titulo="Apariencia">
      <fieldset>
        <legend className="mb-3 text-sm text-tenue">
          Estilo de fondos y tarjetas. Cada uno tiene versión clara y oscura (se cambia en el menú lateral).
        </legend>
        {/* auto-fill: tantas columnas como quepan, se use la tarjeta a lo ancho o a media pantalla */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
          {Object.entries(ESTILOS).map(([valor, { nombre, descripcion, claro, oscuro }]) => {
            const activo = configuracion.estilo_visual === valor;
            return (
              <button
                key={valor}
                type="button"
                onClick={() => elegir({ estilo_visual: valor as EstiloVisual })}
                aria-pressed={activo}
                className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs transition ${
                  activo ? "border-acento-500 bg-realce" : "border-linea hover:bg-realce"
                }`}
              >
                {/* Muestra partida en diagonal: mitad modo claro, mitad modo oscuro */}
                <span
                  className="h-8 w-8 shrink-0 rounded-full ring-1 ring-linea-fuerte"
                  style={{ background: `linear-gradient(135deg, ${claro} 50%, ${oscuro} 50%)` }}
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-texto">{nombre}</span>
                  <span className="block truncate text-tenue">{descripcion}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="mb-3 text-sm text-tenue">Color de acento de botones, menú, gráficas y enlaces.</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {Object.entries(ACENTOS).map(([valor, { nombre, muestra }]) => {
            const activo = configuracion.color_acento === valor;
            return (
              <button
                key={valor}
                type="button"
                onClick={() => elegir({ color_acento: valor as ColorAcento })}
                aria-pressed={activo}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs transition ${
                  activo ? "border-linea-fuerte" : "border-transparent hover:bg-realce"
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
