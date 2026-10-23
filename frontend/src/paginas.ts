import { lazy, type ComponentType } from "react";

// El Dashboard (la página de inicio habitual) va en el paquete principal; el resto
// se descarga aparte. Así la app abre antes, y `precargarPagina` las trae por detrás
// para que al visitarlas ya estén listas (sin el "Cargando…" de la primera vez).

const cargadores = {
  "/transacciones": () => import("./pages/TransaccionesPage"),
  "/presupuestos": () => import("./pages/PresupuestosPage"),
  "/pagos-fijos": () => import("./pages/SuscripcionesPage"),
  "/pagos-fijos/ingresos": () => import("./pages/IngresosPage"),
  "/cuentas": () => import("./pages/CuentasPage"),
  "/cuentas/efectivo": () => import("./pages/EfectivoPage"),
  "/metas": () => import("./pages/MetasPage"),
  "/deudas": () => import("./pages/DeudasPage"),
  "/metas/deseos": () => import("./pages/DeseosPage"),
  "/categorias": () => import("./pages/CategoriasPage"),
  // Las cuatro pestañas de Ajustes viven en el mismo módulo: se descarga una sola vez.
  "/ajustes": () => import("./pages/AjustesPage"),
  "/ajustes/apariencia": () => import("./pages/AjustesPage"),
  "/ajustes/monedas": () => import("./pages/AjustesPage"),
  "/ajustes/seguridad": () => import("./pages/AjustesPage"),
};

type Ruta = keyof typeof cargadores;

/** lazy() espera un "export default": lo adaptamos a nuestras exportaciones con nombre. */
function perezosa<N extends string>(cargar: () => Promise<Record<N, ComponentType>>, nombre: N) {
  return lazy(() => cargar().then((modulo) => ({ default: modulo[nombre] })));
}

export const TransaccionesPage = perezosa(cargadores["/transacciones"], "TransaccionesPage");
export const PresupuestosPage = perezosa(cargadores["/presupuestos"], "PresupuestosPage");
export const SuscripcionesPage = perezosa(cargadores["/pagos-fijos"], "SuscripcionesPage");
export const IngresosPage = perezosa(cargadores["/pagos-fijos/ingresos"], "IngresosPage");
export const CuentasPage = perezosa(cargadores["/cuentas"], "CuentasPage");
export const EfectivoPage = perezosa(cargadores["/cuentas/efectivo"], "EfectivoPage");
export const MetasPage = perezosa(cargadores["/metas"], "MetasPage");
export const DeudasPage = perezosa(cargadores["/deudas"], "DeudasPage");
export const DeseosPage = perezosa(cargadores["/metas/deseos"], "DeseosPage");
export const CategoriasPage = perezosa(cargadores["/categorias"], "CategoriasPage");
export const AjustesPerfilPage = perezosa(cargadores["/ajustes"], "AjustesPerfilPage");
export const AjustesAparienciaPage = perezosa(cargadores["/ajustes"], "AjustesAparienciaPage");
export const AjustesMonedasPage = perezosa(cargadores["/ajustes"], "AjustesMonedasPage");
export const AjustesSeguridadPage = perezosa(cargadores["/ajustes"], "AjustesSeguridadPage");

const pedidas = new Set<string>();

/**
 * Descarga el código de una página sin mostrarla (al pasar el ratón por su enlace).
 * El navegador guarda el módulo: cuando lazy() lo pida, ya está. Pedirla dos veces no
 * cuesta nada, y un fallo aquí no importa (al visitarla se intentará de nuevo).
 */
export function precargarPagina(ruta: string): void {
  if (pedidas.has(ruta) || !(ruta in cargadores)) return;
  pedidas.add(ruta);
  cargadores[ruta as Ruta]().catch(() => pedidas.delete(ruta));
}

/** Props para un enlace: al apuntarlo (ratón, teclado o dedo) se descarga ya su página. */
export function precarga(ruta: string) {
  const cargar = () => precargarPagina(ruta);
  return { onPointerEnter: cargar, onFocus: cargar, onTouchStart: cargar };
}

/**
 * Cuando el navegador está libre tras abrir la app, trae todas las páginas: no compite
 * con la carga inicial y después cada visita es instantánea. Con "ahorro de datos"
 * activado no se hace (solo se precarga al pasar por un enlace).
 */
export function precargarEnReposo(): () => void {
  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conexion?.saveData) return () => {};
  const todas = () => Object.keys(cargadores).forEach(precargarPagina);
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(todas, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(todas, 2000); // Safari aún no tiene requestIdleCallback
  return () => window.clearTimeout(id);
}
