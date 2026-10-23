import { LogOut, Moon, Sun, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router";

import { precarga } from "../paginas";

export interface EnlaceMas {
  ruta: string;
  etiqueta: string;
  icono: LucideIcon;
}

interface MenuMasProps {
  enlaces: EnlaceMas[];
  tema: "claro" | "oscuro";
  onAlternarTema: () => void;
  onCerrarSesion: () => void;
  usuario: string;
  onCerrar: () => void;
}

const CLASE_FILA = "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors";

/** Panel que sube desde abajo en el móvil con los apartados que no caben en la barra. */
export function MenuMas({ enlaces, tema, onAlternarTema, onCerrarSesion, usuario, onCerrar }: MenuMasProps) {
  const panel = useRef<HTMLDivElement>(null);
  const IconoTema = tema === "oscuro" ? Sun : Moon;

  useEffect(() => {
    const alPulsarTecla = (evento: KeyboardEvent) => evento.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsarTecla);
    // El foco entra en el panel: con teclado o lector de pantalla se sigue desde ahí.
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => window.removeEventListener("keydown", alPulsarTecla);
  }, [onCerrar]);

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden">
      <button type="button" aria-label="Cerrar menú" tabIndex={-1} onClick={onCerrar} className="absolute inset-0 bg-black/40" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Más apartados"
        className="absolute inset-x-0 bottom-0 animate-entrada rounded-t-3xl border-t border-linea bg-superficie p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <div className="mb-1 flex items-center justify-between px-4 pt-1">
          <p className="text-xs font-semibold text-tenue">Más</p>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-tenue hover:bg-realce">
            <X size={18} />
          </button>
        </div>
        <nav className="grid grid-cols-2 gap-1">
          {enlaces.map(({ ruta, etiqueta, icono: Icono }) => (
            <NavLink
              key={ruta}
              to={ruta}
              onClick={onCerrar}
              {...precarga(ruta)}
              className={({ isActive }) =>
                `${CLASE_FILA} ${isActive ? "bg-realce text-texto [&>svg]:text-acento-500" : "text-suave hover:bg-realce"}`
              }
            >
              <Icono size={18} />
              {etiqueta}
            </NavLink>
          ))}
        </nav>
        <div className="mt-2 grid grid-cols-2 gap-1 border-t border-linea pt-2">
          <button type="button" onClick={onAlternarTema} className={`${CLASE_FILA} text-suave hover:bg-realce`}>
            <IconoTema size={18} />
            {tema === "oscuro" ? "Modo claro" : "Modo oscuro"}
          </button>
          <button type="button" onClick={onCerrarSesion} className={`${CLASE_FILA} min-w-0 text-suave hover:bg-realce`}>
            <LogOut size={18} className="shrink-0" />
            <span className="truncate">Salir ({usuario})</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
