import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { ACENTOS, ESTILOS, coloresPersonales, type ColoresModo } from "../../config";
import { pintarEstiloPersonal, useConfiguracion } from "../../hooks/useConfiguracion";
import type { ColorAcento, Configuracion, EstiloVisual } from "../../types";
import { Tarjeta } from "../ui/Tarjeta";
import { avisarError } from "./avisarError";

/** Estilo visual y color de acento: se aplican al instante en toda la app. */
export function SeccionApariencia() {
  const { configuracion, actualizarConfiguracion } = useConfiguracion();

  function elegir(cambios: Partial<Configuracion>) {
    actualizarConfiguracion(cambios).catch(avisarError);
  }

  // Tono e intensidad mientras se mueven los deslizadores: se pintan al momento y se guardan
  // cuando paran (una petición por gesto, no una por cada paso del deslizador).
  const guardado = { tinte: configuracion.tinte_personal, viveza: configuracion.viveza_personal };
  const [personal, setPersonal] = useState(guardado);
  useEffect(() => setPersonal({ tinte: configuracion.tinte_personal, viveza: configuracion.viveza_personal }),
    [configuracion.tinte_personal, configuracion.viveza_personal]);
  useEffect(() => {
    if (personal.tinte === guardado.tinte && personal.viveza === guardado.viveza) return;
    const espera = setTimeout(() => elegir({ tinte_personal: personal.tinte, viveza_personal: personal.viveza }), 400);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia lo elegido
  }, [personal.tinte, personal.viveza]);

  function mover(cambio: Partial<typeof personal>) {
    const nuevo = { ...personal, ...cambio };
    setPersonal(nuevo);
    pintarEstiloPersonal(nuevo);
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
          {Object.entries(ESTILOS).map(([valor, estilo]) => {
            const activo = configuracion.estilo_visual === valor;
            const { nombre, descripcion } = estilo;
            // El personalizado se previsualiza con lo que se está eligiendo.
            const { claro, oscuro } = valor === "personal" ? coloresPersonales(personal.tinte, personal.viveza) : estilo;
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
        {configuracion.estilo_visual === "personal" && (
          <div className="mt-4 grid gap-4 rounded-xl bg-superficie-2 p-4 sm:grid-cols-2">
            <Deslizador
              etiqueta="Tono"
              valor={personal.tinte}
              max={360}
              texto={`${personal.tinte}°`}
              // La rueda de color entera, para ver qué tono sale en cada punto.
              fondo={`linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => `oklch(70% 0.15 ${h})`).join(", ")})`}
              onCambio={(tinte) => mover({ tinte })}
            />
            <Deslizador
              etiqueta="Intensidad"
              valor={personal.viveza}
              max={400}
              texto={personal.viveza === 0 ? "Gris" : `${Math.round(personal.viveza / 4)} %`}
              fondo={`linear-gradient(to right, oklch(70% 0 0), oklch(70% 0.15 ${personal.tinte}))`}
              onCambio={(viveza) => mover({ viveza })}
            />
          </div>
        )}
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

/** Un deslizador con su nombre, el valor elegido y una franja de color que lo explica. */
function Deslizador({ etiqueta, valor, max, texto, fondo, onCambio }: {
  etiqueta: string;
  valor: number;
  max: number;
  texto: string;
  fondo: string;
  onCambio: (valor: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 flex justify-between">
        <span className="font-medium text-texto">{etiqueta}</span>
        <span className="tabular-nums text-tenue">{texto}</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={valor}
        onChange={(evento) => onCambio(Number(evento.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full accent-acento-600"
        style={{ background: fondo }}
      />
    </label>
  );
}
