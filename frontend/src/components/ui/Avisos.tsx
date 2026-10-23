import { AlertTriangle, CheckCircle, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { Boton } from "./Boton";
import { cerrarAviso, leerEstado, suscribirse, type Aviso, type Confirmacion } from "./tablonAvisos";

/** Pinta los toasts y el diálogo de confirmación del tablón de avisos. Va una vez en main.tsx. */
export function Avisos() {
  // Se suscribe al tablón (que vive fuera de React) y repinta cuando cambia.
  const { avisos, confirmacion } = useSyncExternalStore(suscribirse, leerEstado);

  return createPortal(
    <>
      {/* En móvil, a todo el ancho y por encima de la barra de navegación; en escritorio, abajo a la derecha */}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-stretch gap-2 sm:left-auto sm:w-96 md:bottom-4">
        {avisos.map((aviso) => (
          <Toast key={aviso.id} aviso={aviso} />
        ))}
      </div>
      {confirmacion && <DialogoConfirmar confirmacion={confirmacion} />}
    </>,
    document.body,
  );
}

function Toast({ aviso }: { aviso: Aviso }) {
  const esError = aviso.tipo === "error";
  const Icono = esError ? AlertTriangle : CheckCircle;
  return (
    <div
      // "alert" interrumpe al lector de pantalla (errores); "status" espera a que termine (éxitos).
      role={esError ? "alert" : "status"}
      className="pointer-events-auto flex animate-entrada items-start gap-3 rounded-2xl bg-superficie p-4 text-sm shadow-2xl ring-1 ring-linea"
    >
      <Icono
        size={18}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${esError ? "text-peligro" : "text-acento-600 dark:text-acento-400"}`}
      />
      <p className="min-w-0 flex-1 break-words">{aviso.texto}</p>
      <button
        type="button"
        onClick={() => cerrarAviso(aviso.id)}
        aria-label="Cerrar aviso"
        className="-m-1 shrink-0 rounded-lg p-1 text-tenue-2 hover:bg-realce hover:text-texto"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function DialogoConfirmar({ confirmacion }: { confirmacion: Confirmacion }) {
  const dialogo = useRef<HTMLDivElement>(null);
  // Se apunta durante el primer pintado, antes de que el diálogo le quite el foco al botón que lo abrió.
  const [anterior] = useState(() => document.activeElement as HTMLElement | null);

  // Al abrir, el foco pasa a "Aceptar" (Intro confirma); al cerrar vuelve a donde estaba.
  // Si la acción es peligrosa (borrar), empieza en "Cancelar": un Intro por inercia no borra nada.
  const peligro = confirmacion.peligro;
  useEffect(() => {
    dialogo.current?.querySelector<HTMLButtonElement>(peligro ? "[data-cancelar]" : "[data-aceptar]")?.focus();
    return () => anterior?.focus();
  }, [anterior, peligro]);

  function alPulsarTecla(evento: KeyboardEvent) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation(); // que no cierre también el modal de debajo (escucha en window)
      confirmacion.responder(false);
    } else if (evento.key === "Enter" && !(evento.target instanceof HTMLButtonElement)) {
      // Sobre un botón, Intro ya lo pulsa (así Intro en "Cancelar" cancela).
      evento.preventDefault();
      confirmacion.responder(true);
    } else if (evento.key === "Tab") {
      // El foco no se escapa del diálogo: solo hay dos botones, se alterna entre ellos.
      const botones = Array.from(dialogo.current?.querySelectorAll("button") ?? []);
      const posicion = botones.indexOf(document.activeElement as HTMLButtonElement);
      const siguiente = (posicion + (evento.shiftKey ? -1 : 1) + botones.length) % botones.length;
      evento.preventDefault();
      botones[siguiente]?.focus();
    }
  }

  const [titulo, ...detalle] = confirmacion.mensaje.split("\n\n");
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={() => confirmacion.responder(false)}
    >
      <div
        ref={dialogo}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-titulo"
        aria-describedby={detalle.length ? "confirmar-detalle" : undefined}
        // tabIndex para que reciba las teclas aunque el foco se pierda con un clic dentro.
        tabIndex={-1}
        onKeyDown={alPulsarTecla}
        onMouseDown={(evento) => evento.stopPropagation()}
        className="w-full max-w-sm animate-entrada rounded-3xl bg-superficie p-6 shadow-2xl ring-1 ring-linea outline-none"
      >
        <h2 id="confirmar-titulo" className="font-semibold break-words">
          {titulo}
        </h2>
        {detalle.length > 0 && (
          <p id="confirmar-detalle" className="mt-2 text-sm whitespace-pre-line text-suave">
            {detalle.join("\n\n")}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Boton data-cancelar variante="secundario" onClick={() => confirmacion.responder(false)}>
            Cancelar
          </Boton>
          <Boton data-aceptar variante={confirmacion.peligro ? "peligro" : "primario"} onClick={() => confirmacion.responder(true)}>
            {confirmacion.textoAceptar}
          </Boton>
        </div>
      </div>
    </div>
  );
}
