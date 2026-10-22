import {
  ArrowLeftRight,
  Handshake,
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
import { Suspense } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { useAcceso } from "../hooks/useAcceso";
import { useConfiguracion } from "../hooks/useConfiguracion";
import { useNotificaciones } from "../hooks/useNotificaciones";
import { useTema } from "../hooks/useTema";
import { AsistenteBienvenida } from "./bienvenida/AsistenteBienvenida";
import { CampanaNotificaciones } from "./CampanaNotificaciones";
import { Avatar } from "./ui/Avatar";
import { Cargando } from "./ui/Estados";

interface ItemMenu {
  ruta: string;
  etiqueta: string;
  /** Versión corta para la barra inferior del móvil, donde hay poco espacio. */
  corta: string;
  icono: LucideIcon;
  /** En la barra inferior del móvil solo caben 6: el resto va como icono en la cabecera. */
  soloEscritorio?: boolean;
}

const MENU: ItemMenu[] = [
  { ruta: "/dashboard", etiqueta: "Dashboard", corta: "Panel", icono: LayoutDashboard },
  { ruta: "/transacciones", etiqueta: "Transacciones", corta: "Movimientos", icono: ArrowLeftRight },
  { ruta: "/presupuestos", etiqueta: "Presupuestos", corta: "Límites", icono: PiggyBank },
  { ruta: "/metas", etiqueta: "Metas", corta: "Metas", icono: Target },
  { ruta: "/deudas", etiqueta: "Deudas", corta: "Deudas", icono: Handshake, soloEscritorio: true },
  { ruta: "/pagos-fijos", etiqueta: "Pagos fijos", corta: "Fijos", icono: Repeat },
  { ruta: "/cuentas", etiqueta: "Cuentas", corta: "Cuentas", icono: Wallet },
  { ruta: "/categorias", etiqueta: "Categorías", corta: "Categorías", icono: Tags, soloEscritorio: true },
];

/** Clases de un enlace del menú lateral según esté activo o no. */
function claseEnlace({ isActive }: { isActive: boolean }): string {
  // Activa: una "píldora" de superficie con el icono en el color de acento.
  return `flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-semibold transition-colors ${
    isActive
      ? "bg-superficie text-texto shadow-[var(--sombra)] ring-1 ring-linea [&>svg]:text-acento-500"
      : "text-tenue hover:bg-realce hover:text-texto"
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
  const location = useLocation();
  const notificaciones = useNotificaciones();

  return (
    <div className="min-h-screen md:flex">
      {/* Menú lateral: solo en pantallas medianas o más grandes */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 p-5 md:flex">
        <div className="mb-8 flex items-center gap-1">
          <Link to="/ajustes" className="flex min-w-0 flex-1 items-center gap-3 rounded-full p-1.5 pr-3 transition-colors hover:bg-realce" title="Editar perfil">
            <Avatar foto={urlFoto} avatar={configuracion.avatar} nombre={nombre} />
            <span className="min-w-0">
              <span className="block text-xs text-tenue">Mis Finanzas</span>
              <span className="block truncate font-semibold">Hola, {nombre}</span>
            </span>
          </Link>
          <CampanaNotificaciones {...notificaciones} />
        </div>

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
          className="flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-semibold text-tenue transition-colors hover:bg-realce hover:text-texto"
        >
          <IconoTema size={18} />
          {tema === "oscuro" ? "Modo claro" : "Modo oscuro"}
        </button>
        <button
          type="button"
          onClick={cerrarSesion}
          className="flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-semibold text-tenue transition-colors hover:bg-realce hover:text-texto"
        >
          <LogOut size={18} />
          <span className="truncate">Salir ({usuario})</span>
        </button>
      </aside>

      {/* Cabecera móvil con ajustes y botón de tema */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-linea bg-fondo/80 px-4 py-3 backdrop-blur-lg md:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar foto={urlFoto} avatar={configuracion.avatar} nombre={nombre} />
          {/* En móviles estrechos no cabe junto a los iconos: queda el avatar. */}
          <span className="hidden truncate font-semibold min-[480px]:inline">Hola, {nombre}</span>
        </span>
        <div className="flex items-center gap-1">
          <CampanaNotificaciones {...notificaciones} />
          {MENU.filter((item) => item.soloEscritorio).map(({ ruta, etiqueta, icono: Icono }) => (
            <Link key={ruta} to={ruta} aria-label={etiqueta} className="rounded-lg p-2 text-tenue">
              <Icono size={18} />
            </Link>
          ))}
          <Link to="/ajustes" aria-label="Ajustes" className="rounded-lg p-2 text-tenue">
            <Settings size={18} />
          </Link>
          <button type="button" onClick={alternar} aria-label="Cambiar tema" className="rounded-lg p-2 text-tenue">
            <IconoTema size={18} />
          </button>
          <button type="button" onClick={cerrarSesion} aria-label="Cerrar sesión" className="rounded-lg p-2 text-tenue">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* key: al cambiar de página se vuelve a montar y se repite la animación de entrada */}
      <main key={location.pathname} className="mx-auto w-full max-w-6xl flex-1 animate-entrada px-4 pt-6 pb-24 md:px-8 md:py-8">
        {/* Mientras se descarga una página (se cargan al visitarlas por primera vez) */}
        <Suspense fallback={<Cargando />}>
          <Outlet />
        </Suspense>
      </main>

      {/* La primera vez: moneda, primera cuenta y recorrido por el menú */}
      {!configuracion.tutorial_visto && <AsistenteBienvenida />}

      {/* Barra inferior en móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-linea bg-superficie/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
        {MENU.filter((item) => !item.soloEscritorio).map(({ ruta, etiqueta, corta, icono: Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            aria-label={etiqueta}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                isActive ? "text-acento-600 dark:text-acento-400" : "text-tenue"
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
