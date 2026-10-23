import {
  ArrowLeftRight,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
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
import { Suspense, useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";

import { useAcceso } from "../hooks/useAcceso";
import { useConfiguracion } from "../hooks/useConfiguracion";
import { useNotificaciones } from "../hooks/useNotificaciones";
import { useTema } from "../hooks/useTema";
import { precarga, precargarEnReposo } from "../paginas";
import { AsistenteBienvenida } from "./bienvenida/AsistenteBienvenida";
import { CampanaNotificaciones } from "./CampanaNotificaciones";
import { MenuMas } from "./MenuMas";
import { Avatar } from "./ui/Avatar";
import { Cargando } from "./ui/Estados";

interface ItemMenu {
  ruta: string;
  etiqueta: string;
  icono: LucideIcon;
  /** En la barra inferior del móvil caben 4 (más «Más»): los de uso diario. El resto, en «Más». */
  enBarra?: boolean;
}

// Los mismos nombres en escritorio y en móvil: así el recorrido y la ayuda valen para los dos.
const MENU: ItemMenu[] = [
  { ruta: "/dashboard", etiqueta: "Dashboard", icono: LayoutDashboard, enBarra: true },
  { ruta: "/transacciones", etiqueta: "Transacciones", icono: ArrowLeftRight, enBarra: true },
  { ruta: "/presupuestos", etiqueta: "Presupuestos", icono: PiggyBank, enBarra: true },
  { ruta: "/metas", etiqueta: "Metas", icono: Target },
  { ruta: "/deudas", etiqueta: "Deudas", icono: Handshake },
  { ruta: "/pagos-fijos", etiqueta: "Pagos fijos", icono: Repeat },
  { ruta: "/cuentas", etiqueta: "Cuentas", icono: Wallet, enBarra: true },
  { ruta: "/categorias", etiqueta: "Categorías", icono: Tags },
];

// En el móvil, «Más» lleva los apartados que no van en la barra y, al final, Ajustes.
const EN_MAS = [...MENU.filter((item) => !item.enBarra), { ruta: "/ajustes", etiqueta: "Ajustes", icono: Settings }];

// tracking-tight: así «Transacciones» cabe entero hasta en móviles de 360 px.
const CLASE_BARRA = "flex min-w-0 flex-col items-center gap-0.5 py-2 text-[10px] font-medium tracking-tight";

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
  const [masAbierto, setMasAbierto] = useState(false);
  const cerrarMas = useCallback(() => setMasAbierto(false), []);
  // «Más» se marca como activo si la página actual es una de las suyas.
  const enMas = EN_MAS.some(({ ruta }) => location.pathname.startsWith(ruta));

  // Con la app ya abierta y el navegador libre, se traen las demás páginas.
  useEffect(() => precargarEnReposo(), []);

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
            <NavLink key={ruta} to={ruta} className={claseEnlace} data-tutorial={ruta} {...precarga(ruta)}>
              <Icono size={18} />
              {etiqueta}
            </NavLink>
          ))}
        </nav>

        <NavLink to="/ajustes" className={claseEnlace} data-tutorial="/ajustes" {...precarga("/ajustes")}>
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

      {/* Cabecera móvil: quién eres y los avisos. El resto del menú, abajo. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-linea bg-fondo/80 px-4 py-3 backdrop-blur-lg md:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar foto={urlFoto} avatar={configuracion.avatar} nombre={nombre} />
          <span className="truncate font-semibold">Hola, {nombre}</span>
        </span>
        <CampanaNotificaciones {...notificaciones} />
      </header>

      {/* key: al cambiar de página se vuelve a montar y se repite la animación de entrada */}
      <main key={location.pathname} className="mx-auto w-full max-w-6xl flex-1 animate-entrada px-4 pt-6 pb-24 md:px-8 md:py-8">
        {/* Si una página aún no se ha descargado (casi nunca: se precargan), un aviso discreto */}
        <Suspense fallback={<Cargando conRetraso />}>
          <Outlet />
        </Suspense>
      </main>

      {/* La primera vez: moneda, primera cuenta, sueldo y recorrido con globos (data-tutorial) */}
      {!configuracion.tutorial_visto && <AsistenteBienvenida />}

      {/* Barra inferior en móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-linea bg-superficie/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
        {MENU.filter((item) => item.enBarra).map(({ ruta, etiqueta, icono: Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            data-tutorial={ruta}
            {...precarga(ruta)}
            className={({ isActive }) => `${CLASE_BARRA} ${isActive ? "text-acento-600 dark:text-acento-400" : "text-tenue"}`}
          >
            <Icono size={20} />
            <span className="max-w-full truncate">{etiqueta}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMasAbierto(true)}
          aria-haspopup="dialog"
          aria-expanded={masAbierto}
          data-tutorial="/mas"
          className={`${CLASE_BARRA} ${enMas || masAbierto ? "text-acento-600 dark:text-acento-400" : "text-tenue"}`}
        >
          <Menu size={20} />
          <span>Más</span>
        </button>
      </nav>
      {masAbierto && (
        <MenuMas
          enlaces={EN_MAS}
          tema={tema}
          onAlternarTema={alternar}
          onCerrarSesion={cerrarSesion}
          usuario={usuario}
          onCerrar={cerrarMas}
        />
      )}
    </div>
  );
}
