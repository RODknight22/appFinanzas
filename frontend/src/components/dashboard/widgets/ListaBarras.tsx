import type { ReactNode } from "react";

import { formatearDinero, formatearPorcentaje } from "../../../utils/formato";

export interface FilaBarra {
  clave: string | number;
  nombre: string;
  /** Línea pequeña bajo el nombre ("3 gastos", "40,00 € de la cuenta"…). */
  detalle?: string;
  total: string;
  /** Sobre el total: da el ancho de la barra. */
  porcentaje: number;
  /** Color de la barra; por defecto, el de acento. */
  color?: string;
  /** Algo a la izquierda (posición, icono…). */
  inicio?: ReactNode;
}

/**
 * Reparto en barras horizontales: más fácil de comparar que un anillo cuando
 * importa el orden (dónde se fue más dinero) y los nombres son largos.
 */
export function ListaBarras({ filas }: { filas: FilaBarra[] }) {
  // La barra más larga ocupa todo el ancho: así las diferencias se ven aunque todas sean pequeñas.
  const maximo = Math.max(...filas.map((f) => f.porcentaje), 0) || 1;
  return (
    <ul className="space-y-3.5">
      {filas.map((fila) => (
        <li key={fila.clave} className="flex items-center gap-3 text-sm">
          {fila.inicio}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{fila.nombre}</span>
              <span className="shrink-0 font-semibold tabular-nums">{formatearDinero(fila.total)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-superficie-2">
              <div
                className={`h-full rounded-full ${fila.color ? "" : "bg-acento-500"}`}
                style={{ width: `${(fila.porcentaje / maximo) * 100}%`, backgroundColor: fila.color }}
              />
            </div>
            <div className="mt-1 flex justify-between gap-2 text-xs text-tenue">
              <span className="truncate">{fila.detalle}</span>
              <span className="shrink-0 tabular-nums">{formatearPorcentaje(fila.porcentaje)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
