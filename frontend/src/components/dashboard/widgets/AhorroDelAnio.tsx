import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, type TooltipProps } from "recharts";

import type { AhorroAnual, AhorroMes } from "../../../types";
import { formatearDinero, formatearMes } from "../../../utils/formato";
import { Vacio } from "../../ui/Estados";

function TooltipAhorro({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const mes = payload[0].payload as AhorroMes;
  return (
    <div className="rounded-xl bg-superficie-2 px-3 py-2 text-xs shadow-lg ring-1 ring-linea">
      <p className="mb-1 font-semibold">{formatearMes(mes.mes_anio)}</p>
      <p className="tabular-nums">Ahorro del mes: {formatearDinero(mes.ahorro)}</p>
      <p className="tabular-nums text-tenue">Acumulado: {formatearDinero(mes.acumulado)}</p>
    </div>
  );
}

/** Ingresos − gastos del año: la cifra acumulada y una barra por mes (verde si ahorraste). */
export function AhorroDelAnio({ datos }: { datos: AhorroAnual }) {
  const hayMovimientos = Number(datos.ingresos) > 0 || Number(datos.gastos) > 0;
  if (!hayMovimientos) return <Vacio mensaje={`Sin ingresos ni gastos en ${datos.anio}`} />;

  const ahorro = Number(datos.ahorro);
  // Recharts necesita números; los importes llegan como texto.
  const filas = datos.meses.map((mes) => ({ ...mes, valor: Number(mes.ahorro) }));
  return (
    <div className="flex h-full flex-col">
      <p className={`text-2xl font-bold tracking-tight tabular-nums sm:text-3xl ${ahorro < 0 ? "text-gasto" : ""}`}>
        {formatearDinero(ahorro)}
      </p>
      <p className="mt-1 text-xs text-tenue">
        {formatearDinero(datos.ingresos)} de ingresos − {formatearDinero(datos.gastos)} de gastos
      </p>
      <div className="mt-auto h-28 pt-3 text-tenue">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filas} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="mes_anio"
              tickFormatter={(mes: string) => formatearMes(mes, "corto").slice(0, 3)}
              tick={{ fill: "currentColor", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.25} />
            <Tooltip content={<TooltipAhorro />} cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
            <Bar dataKey="valor" radius={[4, 4, 4, 4]} maxBarSize={18}>
              {filas.map((mes) => (
                <Cell key={mes.mes_anio} fill={mes.valor < 0 ? "var(--color-gasto)" : "var(--color-ingreso)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
