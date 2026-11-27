import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

interface Estado {
  caja: Caja | null;
  /** Falso en la primera medida (o al reaparecer): la píldora se coloca sin deslizarse desde 0,0. */
  animar: boolean;
}

/**
 * Estilo de la "píldora" que marca el enlace activo de un menú, para que se deslice de una opción
 * a otra en vez de saltar (como el control segmentado de iOS). Mide el enlace con
 * aria-current="page" (NavLink lo pone solo) respecto al contenedor, que debe ser `relative`.
 * Devuelve null si ningún enlace del contenedor está activo: entonces no se pinta la píldora.
 *
 * @param ruta La ruta actual: al cambiar, se vuelve a medir.
 */
export function useIndicadorActivo(contenedor: RefObject<HTMLElement | null>, ruta: string): CSSProperties | null {
  const [{ caja, animar }, setEstado] = useState<Estado>({ caja: null, animar: false });

  // Antes de pintar (layout effect): así nunca se ve un fotograma con la píldora en el sitio viejo.
  useLayoutEffect(() => {
    const elemento = contenedor.current;
    if (!elemento) return;
    function medir() {
      const activo = elemento?.querySelector<HTMLElement>('[aria-current="page"]');
      // Ancho 0: el menú está oculto (p. ej. el lateral en el móvil); se trata como sin activo.
      const nueva = activo?.offsetWidth
        ? { x: activo.offsetLeft, y: activo.offsetTop, ancho: activo.offsetWidth, alto: activo.offsetHeight }
        : null;
      setEstado((previo) => ({ caja: nueva, animar: previo.caja !== null && nueva !== null }));
    }
    medir();
    // Si el menú cambia de tamaño (ventana, fuente, etiquetas que se ocultan en el móvil), se recoloca.
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [contenedor, ruta]);

  if (!caja) return null;
  return {
    width: caja.ancho,
    height: caja.alto,
    transform: `translate(${caja.x}px, ${caja.y}px)`,
    transitionProperty: animar ? "transform, width, height" : "none",
  };
}
