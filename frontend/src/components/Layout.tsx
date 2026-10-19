import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Moon,
  PiggyBank,
  Repeat,
  Settings,
  Sun,
  Tags,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { useAcceso } from "../hooks/useAcceso";
import { useConfiguracion } from "../hooks/useConfiguracion";
import { useTema } from "../hooks/useTema";
import { Avatar } from "./ui/Avatar";

interface ItemMenu {
  ruta: string;
  etiqueta: string;
  /** Versión corta para la barra inferior del móvil, donde hay poco espacio. */
  corta: string;
  icono: LucideIcon;
  /** En la barra inferior del móvil solo caben 6: el resto va en la cabecera. */
  soloEscritorio?: boolean;
}

const MENU: ItemMenu[] = [
  { ruta: "/dashboard", etiqueta: "Dashboard", corta: "Panel", icono: LayoutDashboard },
  { ruta: "/transacciones", etiqueta: "Transacciones", corta: "Movimientos", icono: ArrowLeftRight },
  { ruta: "/presupuestos", etiqueta: "Presupuestos", corta: "Límites", icono: PiggyBank },
  { ruta: "/metas", etiqueta: "Metas", corta: "Metas", icono: Target },
  { ruta: "/suscripciones", etiqueta: "Suscripciones", corta: "Recurrentes", icono: Repeat },
  { ruta: "/cuentas", etiqueta: "Cuentas", corta: "Cuentas", icono: Wallet },
  { ruta: "/categorias", etiqueta: "Categorías", corta: "Categorías", icono: Tags, soloEscritorio: true },
];

/** Clases de un enlace del menú lateral según esté activo o no. */
function claseEnlace({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-acento-50 text-acento-700 dark:bg-acento-950/60 dark:text-acento-300"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
  }`;
}

/**
 * Estructura común a todas las páginas: menú lateral (escritorio) o barra
 * inferior (móvil) y, en <Outlet />, la página de la ruta actual.
 */
export function Layout() {
  const { tema, alternar } = useTema();
  const { usuario, cerrarSesion } = useAcceso();
  const { configuracion, urlFoto } = useConfiguracion();
  // El nombre de Ajustes si lo hay; si no, el de usuario del login.
  const nombre = configuracion.nombre ?? usuario;
  const IconoTema = tema === "oscuro" ? Sun : Moon;

  return (
    <div className="min-h-screen md:flex">
      {/* Menú lateral: solo en pantallas medianas o más grandes */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex dark:border-slate-800 dark:bg-slate-900">
        <Link to="/ajustes" className="mb-8 flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800" title="Editar perfil">
          <Avatar foto={urlFoto} avatar={configuracion.avatar} nombre={nombre} />
          <span className="min-w-0">
            <span className="block text-xs text-slate-500">Mis Finanzas</span>
            <span className="block truncate font-semibold">Hola, {nombre}</span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {MENU.map(({ ruta, etiqueta, icono: Icono }) => (
            <NavLink
              key={ruta}
              to={ruta}
              className={claseEnlace}
            >
              <Icono size={18} />
              {etiqueta}
            </NavLink>
          ))}
        </nav>

        <NavLink to="/ajustes" className={claseEnlace}>
          <Settings size={18} />
          Ajustes
        </NavLink>
        <button
          type="button"
          onClick={alternar}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <IconoTema size={18} />
          {tema === "oscuro" ? "Modo claro" : "Modo oscuro"}
        </button>
        <button
          type="button"
          onClick={cerrarSesion}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <LogOut size={18} />
          <span className="truncate">Salir ({usuario})</span>
        </button>
      </aside>

      {/* Cabecera móvil con ajustes y botón de tema */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-900">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar foto={urlFoto} avatar={configuracion.avatar} nombre={nombre} />
          <span className="truncate font-semibold">Hola, {nombre}</span>
        </span>
        <div className="flex items-center gap-1">
          <Link to="/categorias" aria-label="Categorías" className="rounded-lg p-2 text-slate-500">
            <Tags size={18} />
          </Link>
          <Link to="/ajustes" aria-label="Ajustes" className="rounded-lg p-2 text-slate-500">
            <Settings size={18} />
          </Link>
          <button type="button" onClick={alternar} aria-label="Cambiar tema" className="rounded-lg p-2 text-slate-500">
            <IconoTema size={18} />
          </button>
          <button type="button" onClick={cerrarSesion} aria-label="Cerrar sesión" className="rounded-lg p-2 text-slate-500">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:px-8 md:py-8">
        <Outlet />
      </main>

      {/* Barra inferior en móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-slate-200 bg-white md:hidden dark:border-slate-800 dark:bg-slate-900">
        {MENU.filter((item) => !item.soloEscritorio).map(({ ruta, etiqueta, corta, icono: Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            aria-label={etiqueta}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                isActive ? "text-acento-600 dark:text-acento-400" : "text-slate-500"
              }`
            }
          >
            <Icono size={20} />
            <span className="max-w-full truncate px-0.5">{corta}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
