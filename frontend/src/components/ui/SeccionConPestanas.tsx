import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

export interface Pestana {
  ruta: string;
  etiqueta: string;
  icono: LucideIcon;
}

/**
 * Varias páginas bajo una misma entrada del menú, con pestañas arriba.
 * Cada pestaña es una ruta propia: se puede enlazar, recargar y volver atrás.
 */
export function SeccionConPestanas({ nombre, pestanas }: { nombre: string; pestanas: Pestana[] }) {
  return (
    <>
      <nav aria-label={nombre} className="mb-6 inline-flex max-w-full flex-wrap gap-1 rounded-3xl bg-superficie-2 p-1">
        {pestanas.map(({ ruta, etiqueta, icono: Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            end // la primera pestaña ("/metas") no debe quedar activa en "/metas/deseos"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                isActive ? "bg-superficie text-texto shadow-[var(--sombra)] [&>svg]:text-acento-500" : "text-tenue hover:text-texto"
              }`
            }
          >
            <Icono size={16} />
            {etiqueta}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
