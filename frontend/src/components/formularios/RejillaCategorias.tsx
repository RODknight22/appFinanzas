import type { ReactNode } from "react";

import type { Categoria } from "../../types";
import { IconoCategoria } from "../ui/IconoCategoria";

/** Aspecto de cada casilla; también para botones extra como "Nueva". */
export const CLASE_CASILLA =
  "flex flex-col items-center gap-1.5 rounded-xl p-2 text-xs font-medium ring-1 ring-linea transition hover:bg-realce active:scale-95 disabled:opacity-50";

interface RejillaCategoriasProps {
  categorias: Categoria[];
  onElegir: (categoria: Categoria) => void;
  deshabilitada?: boolean;
  /** Casillas extra al final, p. ej. crear una categoría. */
  children?: ReactNode;
}

/** Categorías como botones grandes con icono: un toque en vez de abrir un desplegable. */
export function RejillaCategorias({ categorias, onElegir, deshabilitada, children }: RejillaCategoriasProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {categorias.map((categoria) => (
        <button
          key={categoria.id}
          type="button"
          disabled={deshabilitada}
          onClick={() => onElegir(categoria)}
          className={CLASE_CASILLA}
        >
          <IconoCategoria icono={categoria.icono} color={categoria.color} tamano="sm" />
          <span className="line-clamp-2 text-center">{categoria.nombre}</span>
        </button>
      ))}
      {children}
    </div>
  );
}
