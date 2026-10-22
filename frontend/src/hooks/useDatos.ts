import { useCallback, useEffect, useState } from "react";

interface EstadoDatos<T> {
  datos: T | undefined;
  cargando: boolean;
  error: string | null;
  /** Vuelve a pedir los datos (p. ej. después de crear o borrar algo). */
  recargar: () => void;
}

/**
 * Última respuesta de cada página, solo en memoria (se pierde al recargar la pestaña).
 * Al volver a una página se pinta al instante lo que se vio la última vez y, por detrás,
 * se piden los datos frescos ("stale-while-revalidate"). Con un tope de entradas para
 * que recorrer muchos meses no acumule memoria sin fin.
 */
const cache = new Map<string, unknown>();
const MAX_ENTRADAS = 40;

function guardarEnCache(clave: string, datos: unknown) {
  cache.delete(clave); // al reinsertarla pasa a ser la más reciente
  cache.set(clave, datos);
  if (cache.size > MAX_ENTRADAS) cache.delete(cache.keys().next().value!);
}

/** Al cerrar sesión: que los datos de una persona no se vean tras el login de otra. */
export function vaciarCacheDatos() {
  cache.clear();
}

/**
 * Carga datos asíncronos y gestiona los estados de "cargando" y "error".
 *
 * `dependencias` funciona como en useEffect: al cambiar (p. ej. el mes
 * seleccionado) se vuelve a cargar automáticamente.
 *
 * `clave` (opcional, única por página): activa la caché. Mientras se refrescan
 * datos ya conocidos, `cargando` es false: la página no parpadea ni se atenúa.
 */
export function useDatos<T>(cargar: () => Promise<T>, dependencias: unknown[], clave?: string): EstadoDatos<T> {
  const claveCache = clave && `${clave}:${JSON.stringify(dependencias)}`;
  const [datos, setDatos] = useState<T | undefined>(() => (claveCache ? (cache.get(claveCache) as T) : undefined));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  // La función `cargar` se crea de nuevo en cada render; memorizarla según
  // `dependencias` evita un bucle infinito de recargas.
  const cargarMemo = useCallback(cargar, dependencias);

  useEffect(() => {
    // Si el componente cambia de filtro antes de que llegue la respuesta,
    // ignoramos la respuesta vieja para no mostrar datos desactualizados.
    let vigente = true;
    const enCache = claveCache ? cache.has(claveCache) : false;
    if (enCache) setDatos(cache.get(claveCache!) as T);
    setCargando(!enCache);
    setError(null);
    cargarMemo()
      .then((resultado) => {
        if (claveCache) guardarEnCache(claveCache, resultado);
        if (vigente) setDatos(resultado);
      })
      .catch((e: unknown) => vigente && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
    // claveCache no hace falta en la lista: se deriva de `dependencias`, que ya están en cargarMemo.
  }, [cargarMemo, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { datos, cargando, error, recargar };
}
