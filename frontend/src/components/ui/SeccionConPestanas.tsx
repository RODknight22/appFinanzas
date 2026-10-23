import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router";

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
  return (
    <>
      <nav aria-label={nombre} className="mb-6 inline-flex max-w-full flex-wrap gap-1 rounded-3xl bg-superficie-2 p-1">
        {pestanas.map(({ ruta, etiqueta, icono: Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            end // la primera pestaña ("/metas") no debe quedar activa en "/metas/deseos"
            {...precarga(ruta)}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                isActive ? "bg-superficie text-texto shadow-[var(--sombra)] [&>svg]:text-acento-500" : "text-tenue hover:text-texto"
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
