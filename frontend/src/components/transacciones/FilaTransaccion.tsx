import { ArrowRightLeft } from "lucide-react";
import { Link } from "react-router";

import { COLOR_CATEGORIA_POR_DEFECTO } from "../../config";
import type { Categoria, Cuenta, Transaccion } from "../../types";
import { formatearDinero, formatearFecha } from "../../utils/formato";
import { AccionesFila } from "../ui/AccionesFila";
import { IconoCategoria } from "../ui/IconoCategoria";

interface FilaTransaccionProps {
  transaccion: Transaccion;
  categoria: Categoria | undefined;
  cuenta: Cuenta | undefined;
  onEditar: () => void;
  onEliminar: () => void;
  /** En el modo selección (edición en masa): la casilla de la fila. */
  seleccion?: { marcada: boolean; onAlternar: () => void };
}

export function FilaTransaccion({ transaccion, categoria, cuenta, onEditar, onEliminar, seleccion }: FilaTransaccionProps) {
  const esGasto = transaccion.tipo === "gasto";
  const esComision = transaccion.transferencia_id !== null;
  return (
    <li className="flex items-center gap-3 py-3">
      {seleccion && (
        <input
          type="checkbox"
          className="size-4 shrink-0 accent-acento-600"
          checked={seleccion.marcada}
          onChange={seleccion.onAlternar}
          // La comisión de una transferencia solo se cambia desde la transferencia.
          disabled={esComision}
          title={esComision ? "Comisión de una transferencia: se edita desde Cuentas" : undefined}
          aria-label={`Seleccionar ${transaccion.notas || categoria?.nombre || "movimiento"} del ${formatearFecha(transaccion.fecha)}`}
        />
      )}
      <IconoCategoria icono={categoria?.icono ?? "circle"} color={categoria?.color ?? COLOR_CATEGORIA_POR_DEFECTO} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{categoria?.nombre ?? "Sin categoría"}</p>
        {/* En móvil hay poco ancho: hasta 2 líneas en vez de cortar en "Banc…" */}
        <p className="line-clamp-2 text-xs text-tenue sm:truncate">
          {formatearFecha(transaccion.fecha)} · {cuenta?.nombre}
          {transaccion.notas && ` · ${transaccion.notas}`}
        </p>
      </div>
      <span className="text-right">
        <span className={`block font-semibold tabular-nums ${esGasto ? "text-gasto" : "text-ingreso"}`}>
          {esGasto ? "−" : "+"}{formatearDinero(transaccion.monto, transaccion.moneda)}
        </span>
        {/* Pagado en otra divisa: lo que movió en la cuenta */}
        {cuenta && transaccion.moneda !== cuenta.moneda && (
          <span className="block text-xs text-tenue tabular-nums">
            ≈ {formatearDinero(transaccion.monto_cuenta, cuenta.moneda)}
          </span>
        )}
      </span>
      {!esComision ? (
        <AccionesFila nombre={transaccion.notas || categoria?.nombre} onEditar={onEditar} onEliminar={onEliminar} />
      ) : (
        // La comisión de una transferencia se cambia desde la transferencia.
        <Link
          to="/cuentas"
          title="Comisión de una transferencia: se edita desde Cuentas"
          aria-label="Editar desde Cuentas"
          className="shrink-0 rounded-lg p-2.5 text-tenue transition-colors hover:bg-realce hover:text-texto sm:p-1.5"
        >
          <ArrowRightLeft size={16} />
        </Link>
      )}
    </li>
  );
}
