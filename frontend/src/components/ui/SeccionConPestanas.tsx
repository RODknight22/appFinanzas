import type { LucideIcon } from "lucide-react";
import { useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { useIndicadorActivo } from "../../hooks/useIndicadorActivo";
import { precarga } from "../../paginas";

export interface Pestana {
  ruta: string;
  etiqueta: string;
  icono: LucideIcon;
}

interface SeccionConPestanasProps {
  nombre: string;
  pestanas: Pestana[];
  /**
   * Para secciones con muchas pestañas: en el móvil, las no activas muestran solo su
   * icono, así caben en una fila. El nombre sigue ahí para lectores de pantalla.
   */
  compacta?: boolean;
}

/**
 * Varias páginas bajo una misma entrada del menú, con pestañas arriba.
 * Cada pestaña es una ruta propia: se puede enlazar, recargar y volver atrás.
 */
export function SeccionConPestanas({ nombre, pestanas, compacta = false }: SeccionConPestanasProps) {
  const menu = useRef<HTMLElement>(null);
  const indicador = useIndicadorActivo(menu, useLocation().pathname);
  return (
    <>
      <nav ref={menu} aria-label={nombre} className="relative mb-6 inline-flex max-w-full flex-wrap gap-1 rounded-3xl bg-superficie-2 p-1">
        {/* La píldora de la pestaña activa va aparte y se desliza de una a otra al cambiar. */}
        {indicador && (
          <span
            aria-hidden
            style={indicador}
            className="pointer-events-none absolute top-0 left-0 rounded-full bg-superficie shadow-[var(--sombra)] duration-(--duracion-media) ease-muelle"
          />
        )}
        {pestanas.map(({ ruta, etiqueta, icono: Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            end // la primera pestaña ("/metas") no debe quedar activa en "/metas/deseos"
            {...precarga(ruta)}
            className={({ isActive }) =>
              // relative: por encima de la píldora, que es absolute.
              `relative flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                isActive ? "text-texto [&>svg]:text-acento-500" : "text-tenue hover:text-texto"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icono size={16} />
                <span className={compacta && !isActive ? "sr-only sm:not-sr-only" : undefined}>{etiqueta}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
