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
}

export function FilaTransaccion({ transaccion, categoria, cuenta, onEditar, onEliminar }: FilaTransaccionProps) {
  const esGasto = transaccion.tipo === "gasto";
  return (
    <li className="flex items-center gap-3 py-3">
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
        <span className={`block font-semibold tabular-nums ${esGasto ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {esGasto ? "−" : "+"}{formatearDinero(transaccion.monto, transaccion.moneda)}
        </span>
        {/* Pagado en otra divisa: lo que movió en la cuenta */}
        {cuenta && transaccion.moneda !== cuenta.moneda && (
          <span className="block text-xs text-tenue tabular-nums">
            ≈ {formatearDinero(transaccion.monto_cuenta, cuenta.moneda)}
          </span>
        )}
      </span>
      {transaccion.transferencia_id === null ? (
        <AccionesFila nombre={transaccion.notas || categoria?.nombre} onEditar={onEditar} onEliminar={onEliminar} />
      ) : (
        // La comisión de una transferencia se cambia desde la transferencia.
        <Link
          to="/cuentas"
          title="Comisión de una transferencia: se edita desde Cuentas"
          aria-label="Editar desde Cuentas"
          className="shrink-0 rounded-lg p-1.5 text-tenue-2 transition-colors hover:bg-realce hover:text-texto"
        >
          <ArrowRightLeft size={16} />
        </Link>
      )}
    </li>
  );
}
