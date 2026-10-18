import type { ReactNode } from "react";

/** Clases comunes para <input> y <select>, para que todos los formularios se vean igual. */
export const CLASE_ENTRADA =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800";

interface CampoProps {
  etiqueta: string;
  children: ReactNode;
  ayuda?: string;
}

/** Etiqueta + control de formulario. Envolver el control en <label> lo asocia sin ids. */
export function Campo({ etiqueta, children, ayuda }: CampoProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-xs text-slate-500">{ayuda}</span>}
    </label>
  );
}

/** Mensaje de error de un formulario (normalmente el que devuelve la API). */
export function ErrorFormulario({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
      {mensaje}
    </p>
  );
}
