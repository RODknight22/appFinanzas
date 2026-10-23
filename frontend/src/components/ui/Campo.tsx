import type { ReactNode } from "react";

/**
 * Clases comunes para <input> y <select>, para que todos los formularios se vean igual.
 * La base no fija el ancho: así se puede añadir w-full o w-auto sin que choquen.
 */
export const CLASE_ENTRADA_BASE =
  "rounded-xl border border-transparent bg-superficie-2 px-3 py-2 text-sm outline-none transition placeholder:text-tenue hover:border-linea-fuerte focus:border-acento-500 focus:ring-2 focus:ring-acento-500/20";
export const CLASE_ENTRADA = `${CLASE_ENTRADA_BASE} w-full`;

interface CampoProps {
  etiqueta: string;
  children: ReactNode;
  ayuda?: string;
}

/**
 * Etiqueta + control de formulario. Envolver el control en <label> lo asocia sin ids.
 * La ayuda va fuera del <label> para no formar parte del nombre del campo
 * (un lector de pantalla diría "Contraseña Mínimo 8 caracteres").
 */
export function Campo({ etiqueta, children, ayuda }: CampoProps) {
  return (
    <div className="space-y-1">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-suave">{etiqueta}</span>
        {children}
      </label>
      {ayuda && <p className="text-xs text-tenue">{ayuda}</p>}
    </div>
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
