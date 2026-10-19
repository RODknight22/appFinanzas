import { useEffect, useState } from "react";

import type { Meta } from "../types";

const CLAVE = "hitos-metas";

export interface Celebracion {
  meta: Meta;
  /** 25, 50, 75 o 100. */
  hito: number;
}

/** El último hito alcanzado: 0, 25, 50, 75 o 100 (una meta cumplida cuenta como 100). */
export function hitoDe(meta: Meta): number {
  if (meta.cumplida) return 100;
  return Math.min(100, Math.floor(meta.porcentaje / 25) * 25);
}

function leerVistos(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? "{}");
  } catch {
    return {}; // navegación privada o dato corrupto: empezamos de cero
  }
}

/**
 * Detecta qué meta acaba de cruzar un hito para celebrarlo.
 *
 * Recuerda en este navegador el último hito celebrado de cada meta. Así
 * también se celebra lo que avanzó sin que miraras (p. ej. una meta que sigue
 * el saldo de una cuenta). La primera vez que ve una meta no la celebra: lo
 * ahorrado antes no es una novedad.
 */
export function useHitosMetas(metas: Meta[] | undefined) {
  const [celebracion, setCelebracion] = useState<Celebracion | null>(null);

  useEffect(() => {
    if (!metas) return;
    const vistos = leerVistos();
    let mayor: Celebracion | null = null;
    for (const meta of metas) {
      const hito = hitoDe(meta);
      const visto = vistos[meta.id];
      // Solo el hito más alto de esta vez: tres celebraciones seguidas cansarían.
      if (visto !== undefined && hito > visto && (!mayor || hito > mayor.hito)) mayor = { meta, hito };
      // Nunca baja: si retiras dinero y lo vuelves a poner, el mismo hito no se repite.
      vistos[meta.id] = Math.max(visto ?? 0, hito);
    }
    try {
      localStorage.setItem(CLAVE, JSON.stringify(vistos));
    } catch {
      // Sin almacenamiento, simplemente no se recordarán los hitos.
    }
    if (mayor) setCelebracion(mayor);
  }, [metas]);

  return { celebracion, cerrar: () => setCelebracion(null) };
}
