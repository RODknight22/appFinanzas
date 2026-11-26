import { TrendingDown, TrendingUp } from "lucide-react";

import type { ComparativaPeriodo, Dinero } from "../../../types";
import { formatearDinero, formatearPorcentaje } from "../../../utils/formato";
import { Vacio } from "../../ui/Estados";

interface FilaProps {
  etiqueta: string;
  actual: Dinero;
  anterior: Dinero;
  variacion: number | null;
  /** En los gastos, subir es malo: el color va al revés. */
  subirEsMalo: boolean;
  color: string;
}

function Fila({ etiqueta, actual, anterior, variacion, subirEsMalo, color }: FilaProps) {
  // Menos de 0,05 % es redondeo: no merece flecha ni color.
  const cambia = variacion !== null && Math.abs(variacion) >= 0.05;
  const sube = (variacion ?? 0) > 0;
  const buena = sube !== subirEsMalo;
  const Icono = sube ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center gap-3">
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-tenue">{etiqueta}</p>
        <p className="truncate text-lg font-bold tabular-nums">{formatearDinero(actual)}</p>
        <p className="truncate text-xs text-tenue tabular-nums">antes {formatearDinero(anterior)}</p>
      </div>
      {cambia ? (
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            buena ? "bg-ingreso/15 text-ingreso" : "bg-gasto/15 text-gasto"
          }`}
        >
          <Icono size={12} /> {formatearPorcentaje(Math.abs(variacion))}
        </span>
      ) : (
        <span className="shrink-0 text-xs text-tenue" title={variacion === null ? "Antes no hubo movimientos con los que comparar" : undefined}>
          {variacion === null ? "—" : "Igual"}
        </span>
      )}
    </div>
  );
}

/** Gasto e ingreso del periodo frente al anterior de igual duración (o el mes anterior). */
export function Comparativa({ datos }: { datos: ComparativaPeriodo }) {
  const { actual, anterior } = datos;
  const sinNada = [actual.gastos, actual.ingresos, anterior.gastos, anterior.ingresos].every((v) => Number(v) === 0);
  if (sinNada) return <Vacio mensaje="Aún no hay movimientos con los que comparar" />;
  return (
    <div className="space-y-4">
      <Fila
        etiqueta="Gastos"
        actual={actual.gastos}
        anterior={anterior.gastos}
        variacion={datos.variacion_gastos}
        subirEsMalo
        color="var(--color-gasto)"
      />
      <Fila
        etiqueta="Ingresos"
        actual={actual.ingresos}
        anterior={anterior.ingresos}
        variacion={datos.variacion_ingresos}
        subirEsMalo={false}
        color="var(--color-ingreso)"
      />
    </div>
  );
}
