import type { ButtonHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "peligro" | "fantasma";

const ESTILOS: Record<Variante, string> = {
  primario: "bg-acento-600 text-white hover:bg-acento-500",
  secundario:
    "bg-superficie-2 text-texto ring-1 ring-linea hover:bg-realce",
  peligro: "bg-rose-600 text-white hover:bg-rose-700",
  fantasma:
    "text-tenue hover:bg-realce hover:text-texto",
};

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
}

/** Botón con los estilos de la app. Acepta cualquier prop nativa de <button>. */
export function Boton({ variante = "primario", className = "", type = "button", ...props }: BotonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-500 disabled:cursor-not-allowed disabled:opacity-50 ${ESTILOS[variante]} ${className}`}
      {...props}
    />
  );
}
