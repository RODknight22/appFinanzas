import { Pencil, Trash2 } from "lucide-react";

interface AccionesFilaProps {
  onEditar: () => void;
  onEliminar: () => void;
  /** Nombre del elemento: el lector de pantalla dice "Editar Netflix" en vez de solo "Editar". */
  nombre?: string;
  /** Si no se puede borrar, por qué: el botón queda apagado y lo explica al pasar el ratón. */
  motivoNoEliminar?: string;
}

/** Botones de editar y eliminar que aparecen en cada fila de una lista. */
export function AccionesFila({ onEditar, onEliminar, nombre, motivoNoEliminar }: AccionesFilaProps) {
  const clase =
    "rounded-lg p-1.5 text-tenue-2 transition-colors hover:bg-realce";
  const sufijo = nombre ? ` ${nombre}` : "";
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={onEditar} aria-label={`Editar${sufijo}`} className={`${clase} hover:text-texto`}>
        <Pencil size={16} />
      </button>
      {motivoNoEliminar ? (
        // aria-disabled (no disabled): sigue recibiendo el foco y el ratón, así el motivo
        // (title, que el lector de pantalla también lee) se puede consultar.
        <button
          type="button"
          aria-disabled="true"
          aria-label={`Eliminar${sufijo}`}
          title={motivoNoEliminar}
          className="cursor-not-allowed rounded-lg p-1.5 text-tenue-2 opacity-40"
        >
          <Trash2 size={16} />
        </button>
      ) : (
        <button type="button" onClick={onEliminar} aria-label={`Eliminar${sufijo}`} className={`${clase} hover:text-peligro`}>
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
