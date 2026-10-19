import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipProps } from "recharts";

import type { GastoPorCategoria } from "../../types";
import { formatearDinero } from "../../utils/formato";
import { Vacio } from "../ui/Estados";
import { IconoCategoria } from "../ui/IconoCategoria";

function TooltipCategoria({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const gasto = payload[0].payload as GastoPorCategoria;
  return (
    <div className="rounded-xl bg-superficie-2 px-3 py-2 text-xs shadow-lg ring-1 ring-linea">
      <p className="font-semibold">{gasto.nombre}</p>
      <p className="tabular-nums">
        {formatearDinero(gasto.total)} · {gasto.porcentaje}%
      </p>
    </div>
  );
}

/** Gráfico de anillo con el reparto del gasto del mes y su leyenda. */
export function GraficoCategorias({ datos }: { datos: GastoPorCategoria[] }) {
  if (datos.length === 0) return <Vacio mensaje="Sin gastos este mes" />;

  // Recharts lee `valor` como número para calcular el tamaño de cada porción.
  const porciones = datos.map((gasto) => ({ ...gasto, valor: Number(gasto.total) }));
  const total = porciones.reduce((suma, p) => suma + p.valor, 0);

  return (
    <div>
      {/* relative: el total se superpone en el hueco del anillo */}
      <div className="relative h-48">
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-tenue">Total</span>
          <span className="text-lg font-bold tabular-nums">{formatearDinero(total)}</span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={porciones} dataKey="valor" nameKey="nombre" innerRadius="72%" outerRadius="100%" paddingAngle={3} cornerRadius={6} stroke="none">
              {porciones.map((gasto) => (
                <Cell key={gasto.categoria_id} fill={gasto.color} />
              ))}
            </Pie>
            <Tooltip content={<TooltipCategoria />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-4 space-y-2">
        {datos.slice(0, 5).map((gasto) => (
          <li key={gasto.categoria_id} className="flex items-center gap-3 text-sm">
            <IconoCategoria icono={gasto.icono} color={gasto.color} tamano="sm" />
            <span className="flex-1 truncate">{gasto.nombre}</span>
            <span className="text-xs text-tenue">{gasto.porcentaje}%</span>
            <span className="font-medium tabular-nums">{formatearDinero(gasto.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
