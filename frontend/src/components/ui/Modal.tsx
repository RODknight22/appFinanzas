import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  titulo: string;
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
}

/** Ventana superpuesta para formularios. Se cierra con Escape o clic fuera. */
export function Modal({ titulo, abierto, onCerrar, children }: ModalProps) {
  useEffect(() => {
    if (!abierto) return;
    const alPulsarTecla = (evento: KeyboardEvent) => evento.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsarTecla);
    return () => window.removeEventListener("keydown", alPulsarTecla);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  // Portal: se pinta en <body>, fuera de la página. Así ningún transform o
  // animación de un contenedor puede descolocar el position: fixed.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="max-h-[90vh] w-full max-w-md animate-entrada overflow-y-auto rounded-3xl bg-superficie p-6 shadow-2xl ring-1 ring-linea"
        // Evita que un clic dentro del modal llegue al fondo y lo cierre.
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <header className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-tenue-2 hover:bg-realce hover:text-texto"
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
