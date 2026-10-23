import { Check } from "lucide-react";

import { ACENTOS, ESTILOS, type ColoresModo } from "../../config";
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
    <Tarjeta titulo="Estilo y color">
      <fieldset>
        <legend className="mb-3 text-sm text-tenue">
          Estilo de fondos y tarjetas: a la izquierda en modo claro y a la derecha en oscuro. El modo
          se cambia con el botón de la luna o el sol.
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
                className={`flex flex-col gap-2 rounded-xl border p-2 text-left text-xs transition ${
                  activo ? "border-acento-500 bg-realce" : "border-linea hover:bg-realce"
                }`}
              >
                {/* Mini vista previa: mitad modo claro, mitad modo oscuro */}
                <span aria-hidden className="flex h-16 w-full overflow-hidden rounded-lg ring-1 ring-linea">
                  <VistaPrevia colores={claro} />
                  <VistaPrevia colores={oscuro} />
                </span>
                <span className="min-w-0 px-0.5">
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

/** Una tarjeta en miniatura sobre el fondo del estilo, con el color de acento elegido. */
function VistaPrevia({ colores: { fondo, tarjeta, texto } }: { colores: ColoresModo }) {
  return (
    <span className="flex-1 p-2" style={{ backgroundColor: fondo }}>
      {/* El borde sale del propio texto: se ve tanto en claro como en oscuro */}
      <span
        className="block space-y-1 rounded-md p-1.5"
        style={{ backgroundColor: tarjeta, boxShadow: `0 0 0 1px color-mix(in oklch, ${texto} 12%, transparent)` }}
      >
        <span className="block h-1 w-3/5 rounded-full opacity-80" style={{ backgroundColor: texto }} />
        <span className="block h-1 w-2/5 rounded-full opacity-30" style={{ backgroundColor: texto }} />
        <span className="block h-1.5 w-1/2 rounded-full bg-acento-500" />
      </span>
    </span>
  );
}
