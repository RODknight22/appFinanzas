import type { Categoria, Transaccion } from "../../../types";
import { formatearDinero, formatearFecha } from "../../../utils/formato";
import { Vacio } from "../../ui/Estados";
import { IconoCategoria } from "../../ui/IconoCategoria";

interface ListaUltimasProps {
  transacciones: Transaccion[];
  categorias: Categoria[];
}

/** Los últimos movimientos registrados, de cualquier mes. */
export function ListaUltimas({ transacciones, categorias }: ListaUltimasProps) {
  if (transacciones.length === 0) return <Vacio mensaje="Aún no hay movimientos" />;
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  return (
    <ul className="space-y-3">
      {transacciones.map((transaccion) => {
        const categoria = categoriaPorId.get(transaccion.categoria_id);
        const esGasto = transaccion.tipo === "gasto";
        return (
          <li key={transaccion.id} className="flex items-center gap-3 text-sm">
            <IconoCategoria icono={categoria?.icono ?? "circle"} color={categoria?.color ?? "#64748b"} tamano="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{transaccion.notas || categoria?.nombre}</span>
              <span className="text-xs text-slate-500">{formatearFecha(transaccion.fecha)}</span>
            </span>
            <span className={`font-medium tabular-nums ${esGasto ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {esGasto ? "−" : "+"}
              {formatearDinero(transaccion.monto, transaccion.moneda)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
