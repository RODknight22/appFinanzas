import { Banknote, Wallet } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const PESTANAS = [
  { ruta: "/cuentas", etiqueta: "Cuentas", icono: Wallet },
  { ruta: "/cuentas/efectivo", etiqueta: "Efectivo", icono: Banknote },
];

/**
 * Cuentas y Efectivo comparten entrada en el menú, pero siguen siendo dos páginas:
 * el efectivo (lo que menos se usa) tiene su propia pestaña con retiros y gasto rápido.
 */
export function SeccionCuentas() {
  return (
    <>
      <nav aria-label="Secciones de cuentas" className="mb-6 inline-flex rounded-full bg-superficie-2 p-1">
        {PESTANAS.map(({ ruta, etiqueta, icono: Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            end // "/cuentas" no debe quedar activa en "/cuentas/efectivo"
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
