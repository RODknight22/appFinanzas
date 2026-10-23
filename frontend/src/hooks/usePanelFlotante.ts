import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

const MARGEN = 8; // distancia mínima a los bordes de la ventana
const SEPARACION = 6; // entre el botón y el panel

export interface PosicionPanel {
  top: number;
  left: number;
  ancho: number;
}

/**
 * Coloca un panel flotante (calendario, cuadrícula de meses…) pegado a su botón y lo
 * cierra con un clic fuera. Devuelve null hasta haberlo medido: mientras, el panel debe
 * estar oculto para que no aparezca un instante en la esquina.
 */
export function usePanelFlotante(
  disparador: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
  anchoMaximo: number,
  onCerrar: () => void,
): PosicionPanel | null {
  const [posicion, setPosicion] = useState<PosicionPanel | null>(null);

  // Debajo del botón; encima si abajo no cabe. Se recoloca al hacer scroll (un modal
  // también se desplaza) y cuando el panel cambia de alto (p. ej. de días a meses).
  useLayoutEffect(() => {
    function colocar() {
      const boton = disparador.current;
      const elemento = panel.current;
      if (!boton || !elemento) return;
      const rect = boton.getBoundingClientRect();
      const ancho = Math.min(anchoMaximo, window.innerWidth - 2 * MARGEN);
      const alto = elemento.offsetHeight;
      const left = Math.min(Math.max(MARGEN, rect.left), window.innerWidth - ancho - MARGEN);
      const cabeAbajo = rect.bottom + SEPARACION + alto <= window.innerHeight - MARGEN;
      const cabeArriba = rect.top - SEPARACION - alto >= MARGEN;
      const top = cabeAbajo || !cabeArriba ? rect.bottom + SEPARACION : rect.top - SEPARACION - alto;
      setPosicion({ top, left, ancho });
    }
    colocar();
    const observador = new ResizeObserver(colocar);
    if (panel.current) observador.observe(panel.current);
    window.addEventListener("resize", colocar);
    window.addEventListener("scroll", colocar, true);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", colocar);
      window.removeEventListener("scroll", colocar, true);
    };
  }, [disparador, panel, anchoMaximo]);

  // Un clic fuera (ni en el panel ni en su botón) lo cierra sin cambiar nada.
  // En captura: el modal detiene la propagación de sus clics y no llegarían al document.
  useEffect(() => {
    function alPulsar(evento: MouseEvent) {
      const objetivo = evento.target as Node;
      if (!panel.current?.contains(objetivo) && !disparador.current?.contains(objetivo)) onCerrar();
    }
    document.addEventListener("mousedown", alPulsar, true);
    return () => document.removeEventListener("mousedown", alPulsar, true);
  }, [disparador, panel, onCerrar]);

  return posicion;
}
