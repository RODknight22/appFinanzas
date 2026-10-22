import { useCallback, useEffect, useState } from "react";

interface EstadoDatos<T> {
  datos: T | undefined;
  cargando: boolean;
  error: string | null;
  /** Vuelve a pedir los datos (p. ej. después de crear o borrar algo). */
  recargar: () => void;
}

/**
 * Carga datos asíncronos y gestiona los estados de "cargando" y "error".
 *
 * `dependencias` funciona como en useEffect: al cambiar (p. ej. el mes
 * seleccionado) se vuelve a cargar automáticamente.
 */
export function useDatos<T>(cargar: () => Promise<T>, dependencias: unknown[]): EstadoDatos<T> {
  const [datos, setDatos] = useState<T>();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  // La función `cargar` se crea de nuevo en cada render; memorizarla según
  // `dependencias` evita un bucle infinito de recargas. El linter no puede comprobar
  // dependencias que llegan como parámetro: las declara quien llama, como en useEffect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargarMemo = useCallback(cargar, dependencias);

  useEffect(() => {
    // Si el componente cambia de filtro antes de que llegue la respuesta,
    // ignoramos la respuesta vieja para no mostrar datos desactualizados.
    let vigente = true;
    setCargando(true);
    setError(null);
    cargarMemo()
      .then((resultado) => vigente && setDatos(resultado))
      .catch((e: unknown) => vigente && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [cargarMemo, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { datos, cargando, error, recargar };
}
