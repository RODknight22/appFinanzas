import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { Celebracion } from "../../hooks/useHitosMetas";
import { lanzarConfeti, lanzarFiesta } from "../../utils/confeti";
import { formatearDinero, formatearPorcentaje } from "../../utils/formato";
import { Boton } from "../ui/Boton";

const MENSAJES: Record<number, { titulo: string; texto: (faltan: string) => string }> = {
  25: { titulo: "¡Primer cuarto conseguido!", texto: (faltan) => `Lo más difícil es empezar, y ya lo hiciste. Faltan ${faltan}.` },
  50: { titulo: "¡A mitad de camino!", texto: (faltan) => `Ya tienes la mitad. Faltan ${faltan}: vas genial.` },
  75: { titulo: "¡Ya casi lo tienes!", texto: (faltan) => `Solo te faltan ${faltan}. Recta final.` },
  100: { titulo: "¡Meta cumplida!", texto: () => "Lo lograste. Date un gusto (con cabeza) y piensa cuál es la siguiente." },
};

const RADIO = 52;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

/** Ventana de celebración al cruzar el 25 / 50 / 75 / 100 % de una meta. */
export function CelebracionHito({ celebracion, onCerrar }: { celebracion: Celebracion; onCerrar: () => void }) {
  const { meta, hito } = celebracion;
  const mensaje = MENSAJES[hito];
  // El anillo empieza vacío y se llena tras montarse: la transición CSS hace la animación.
  const [lleno, setLleno] = useState(0);

  useEffect(() => {
    const temporizador = setTimeout(() => setLleno(hito), 80);
    if (hito === 100) lanzarFiesta();
    else lanzarConfeti({ y: 0.85, cantidad: 100 + hito, dispersion: 90 });
    return () => clearTimeout(temporizador);
  }, [hito]);

  useEffect(() => {
    const alPulsarTecla = (evento: KeyboardEvent) => evento.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsarTecla);
    return () => window.removeEventListener("keydown", alPulsarTecla);
  }, [onCerrar]);

  // Portal a <body>, como Modal: nada de la página puede descolocarla.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mensaje.titulo}
        className="w-full max-w-sm animate-pop rounded-3xl bg-superficie p-8 text-center shadow-2xl ring-1 ring-linea"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="relative mx-auto h-36 w-36">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={RADIO} fill="none" strokeWidth="10" className="stroke-superficie-2" />
            <circle
              cx="60"
              cy="60"
              r={RADIO}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              className={`transition-[stroke-dashoffset] duration-1000 ease-out ${hito === 100 ? "stroke-exito" : "stroke-acento-400"}`}
              strokeDasharray={CIRCUNFERENCIA}
              strokeDashoffset={CIRCUNFERENCIA * (1 - lleno / 100)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl" aria-hidden>{meta.icono}</span>
            <span className="text-lg font-bold tabular-nums">{formatearPorcentaje(hito)}</span>
          </div>
        </div>

        <h2 className="mt-5 text-2xl font-bold tracking-tight">{mensaje.titulo}</h2>
        <p className="mt-1 font-semibold text-acento-500">{meta.nombre}</p>
        <p className="mt-3 text-sm text-tenue">{mensaje.texto(formatearDinero(meta.restante, meta.moneda))}</p>
        <p className="mt-3 text-sm tabular-nums">
          <strong>{formatearDinero(meta.ahorrado, meta.moneda)}</strong>
          <span className="text-tenue"> de {formatearDinero(meta.monto_objetivo, meta.moneda)}</span>
        </p>

        <Boton className="mt-6 w-full" onClick={onCerrar} autoFocus>
          {hito === 100 ? "¡Genial!" : "¡A seguir ahorrando!"}
        </Boton>
      </div>
    </div>,
    document.body,
  );
}
