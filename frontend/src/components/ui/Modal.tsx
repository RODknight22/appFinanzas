import { X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  titulo: string;
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
  /** "amplio" para contenidos con tablas o listas largas (p. ej. importar un extracto). */
  ancho?: "normal" | "amplio";
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Ventana superpuesta para formularios. Se cierra con Escape o clic fuera. */
export function Modal({ abierto, ...props }: ModalProps) {
  // El panel solo existe mientras está abierto: así sus efectos marcan justo la apertura y el cierre.
  return abierto ? <PanelModal {...props} /> : null;
}

function PanelModal({ titulo, onCerrar, children, ancho = "normal" }: Omit<ModalProps, "abierto">) {
  const panel = useRef<HTMLDivElement>(null);
  // Se apunta durante el primer pintado, antes de que un autoFocus del formulario le quite el foco.
  const [anterior] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const alPulsarTecla = (evento: globalThis.KeyboardEvent) => evento.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsarTecla);
    return () => window.removeEventListener("keydown", alPulsarTecla);
  }, [onCerrar]);

  // Al abrir: el foco entra al modal (si un campo con autoFocus no lo tiene ya) y la página
  // de detrás deja de hacer scroll. Al cerrar: todo vuelve a como estaba.
  // `inicial` se guarda la primera vez: en desarrollo (StrictMode) el efecto se repite y,
  // entre medias, la limpieza ya devolvió el foco fuera; sin él se perdería el autoFocus.
  const inicial = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const activo = document.activeElement;
    inicial.current ??= activo instanceof HTMLElement && panel.current?.contains(activo) ? activo : panel.current;
    inicial.current?.focus();
    const scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = scrollPrevio;
      anterior?.focus();
    };
  }, [anterior]);

  /** El Tab no se escapa a la página de detrás: del último elemento salta al primero y al revés. */
  function alPulsarTab(evento: KeyboardEvent) {
    const actual = document.activeElement;
    // Fuera del panel (p. ej. en el calendario de SelectorFecha, que va en su propio portal) no se toca.
    if (evento.key !== "Tab" || !panel.current?.contains(actual)) return;
    const enfocables = Array.from(panel.current.querySelectorAll<HTMLElement>(ENFOCABLES));
    if (enfocables.length === 0) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (evento.shiftKey && (actual === primero || actual === panel.current)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && actual === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  // Portal: se pinta en <body>, fuera de la página. Así ningún transform o
  // animación de un contenedor puede descolocar el position: fixed.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={onCerrar}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        // tabIndex para poder recibir el foco al abrir cuando no hay un campo con autoFocus.
        tabIndex={-1}
        onKeyDown={alPulsarTab}
        className={`max-h-[90vh] w-full ${ancho === "amplio" ? "max-w-3xl" : "max-w-md"} animate-entrada overflow-y-auto rounded-3xl bg-superficie p-6 shadow-2xl ring-1 ring-linea outline-none`}
        // Evita que un clic que empieza dentro del modal llegue al fondo y lo cierre.
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
