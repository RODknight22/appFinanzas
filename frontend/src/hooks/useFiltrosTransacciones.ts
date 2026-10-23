import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import type { FiltrosTransacciones } from "../api/recursos";
import type { MesAnio, TipoMovimiento } from "../types";
import { mesActual, rangoDelMes } from "../utils/formato";

export const POR_PAGINA = 50;

/** Lo que el usuario elige en la pantalla (todo texto: así viene de la URL). */
export interface Filtros {
  texto: string;
  /** Un mes "YYYY-MM" o "todo" para buscar en todo el historial. */
  periodo: MesAnio | "todo";
  tipo: TipoMovimiento | "";
  cuenta: string;
  categoria: string;
  min: string;
  max: string;
  pagina: number;
}

/** Filtros que van en el panel "Más filtros" (para contar cuántos hay activos). */
export const FILTROS_AVANZADOS = ["cuenta", "categoria", "min", "max"] as const;

/**
 * Los filtros viven en la URL (?texto=tacos&periodo=todo…) y no en un useState:
 * así sobreviven a recargar la página, al botón "atrás" y se pueden guardar como marcador.
 */
export function useFiltrosTransacciones() {
  const [parametros, setParametros] = useSearchParams();
  const filtros: Filtros = {
    texto: parametros.get("texto") ?? "",
    periodo: parametros.get("periodo") ?? mesActual(),
    tipo: (parametros.get("tipo") ?? "") as Filtros["tipo"],
    cuenta: parametros.get("cuenta") ?? "",
    categoria: parametros.get("categoria") ?? "",
    min: parametros.get("min") ?? "",
    max: parametros.get("max") ?? "",
    pagina: Math.max(Number(parametros.get("pagina")) || 1, 1),
  };

  /** Cambia algunos filtros. Cualquier cambio que no sea de página vuelve a la página 1. */
  function cambiar(cambios: Partial<Filtros>) {
    const siguientes: Filtros = { ...filtros, pagina: 1, ...cambios };
    const nuevos = new URLSearchParams();
    for (const [clave, valor] of Object.entries(siguientes)) {
      // No ensuciamos la URL con valores por defecto.
      const porDefecto = (clave === "periodo" && valor === mesActual()) || (clave === "pagina" && valor === 1);
      if (valor !== "" && !porDefecto) nuevos.set(clave, String(valor));
    }
    // replace: escribir en el buscador no debe llenar el historial del navegador.
    setParametros(nuevos, { replace: true });
  }

  function limpiar() {
    setParametros(filtros.periodo === mesActual() ? {} : { periodo: filtros.periodo }, { replace: true });
  }

  return { filtros, cambiar, limpiar };
}

/** Traduce los filtros de la pantalla a los parámetros de la API. */
export function aConsulta(filtros: Filtros): FiltrosTransacciones {
  return {
    ...(filtros.periodo === "todo" ? {} : rangoDelMes(filtros.periodo)),
    texto: filtros.texto.trim() || undefined,
    tipo: filtros.tipo || undefined,
    cuenta_id: filtros.cuenta ? Number(filtros.cuenta) : undefined,
    categoria_id: filtros.categoria ? Number(filtros.categoria) : undefined,
    monto_min: filtros.min || undefined,
    monto_max: filtros.max || undefined,
    offset: (filtros.pagina - 1) * POR_PAGINA,
    limit: POR_PAGINA,
  };
}

/**
 * Devuelve `valor` con retraso: solo cuando deja de cambiar durante `ms`.
 * Evita pedir resultados al servidor con cada letra que se escribe.
 */
export function useValorRetrasado<T>(valor: T, ms: number): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(temporizador); // si vuelve a cambiar antes, se cancela
  }, [valor, ms]);
  return retrasado;
}
