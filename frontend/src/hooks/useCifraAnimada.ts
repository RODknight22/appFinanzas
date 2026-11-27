import { useEffect, useRef, useState } from "react";

const DURACION_MS = 600;

/** ease-out cúbica: arranca rápido y frena al llegar, como las demás transiciones de la app. */
const frenar = (t: number) => 1 - (1 - t) ** 3;

function prefiereMenosMovimiento(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Cuenta ascendente de una cifra: de 0 al aparecer (o del valor anterior al nuevo si cambia).
 * Devuelve el número intermedio mientras anima y null al terminar: entonces quien la pinta
 * muestra el valor exacto. El intermedio es un float aproximado y solo sirve para la vista;
 * los importes reales siguen siendo strings Decimal.
 */
export function useCifraAnimada(objetivo: number): number | null {
  const [intermedio, setIntermedio] = useState<number | null>(() => (prefiereMenosMovimiento() ? null : 0));
  // Lo último que se vio: si el objetivo cambia a media animación, se sigue desde ahí sin saltos.
  const mostrado = useRef(0);

  useEffect(() => {
    const origen = mostrado.current;
    if (prefiereMenosMovimiento() || !Number.isFinite(objetivo) || objetivo === origen) {
      mostrado.current = objetivo;
      setIntermedio(null);
      return;
    }
    const inicio = performance.now();
    let fotograma = requestAnimationFrame(function paso(ahora: number) {
      const t = Math.min(1, (ahora - inicio) / DURACION_MS);
      if (t < 1) {
        mostrado.current = origen + (objetivo - origen) * frenar(t);
        setIntermedio(mostrado.current);
        fotograma = requestAnimationFrame(paso);
      } else {
        mostrado.current = objetivo;
        setIntermedio(null);
      }
    });
    return () => cancelAnimationFrame(fotograma);
  }, [objetivo]);

  return intermedio;
}
