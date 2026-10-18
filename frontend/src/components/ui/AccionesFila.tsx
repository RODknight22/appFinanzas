import { Pencil, Trash2 } from "lucide-react";

interface AccionesFilaProps {
  onEditar: () => void;
  onEliminar: () => void;
}

/** Botones de editar y eliminar que aparecen en cada fila de una lista. */
export function AccionesFila({ onEditar, onEliminar }: AccionesFilaProps) {
  const clase =
    "rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800";
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={onEditar} aria-label="Editar" className={`${clase} hover:text-slate-700 dark:hover:text-slate-200`}>
        <Pencil size={16} />
      </button>
      <button type="button" onClick={onEliminar} aria-label="Eliminar" className={`${clase} hover:text-rose-600`}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}
