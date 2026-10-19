import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import type { FlujoMensual } from "../../types";
import { formatearDinero, formatearMes } from "../../utils/formato";
import { Vacio } from "../ui/Estados";

// Tonos 400: menos saturados que los 500, se ven más suaves sobre fondo oscuro.
const COLOR_INGRESOS = "#34d399";
const COLOR_GASTOS = "#fb7185";

/** Tooltip propio con clases de Tailwind, para que respete el modo oscuro. */
function TooltipFlujo({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-superficie-2 px-3 py-2 text-xs shadow-lg ring-1 ring-linea">
      <p className="mb-1 font-semibold">{formatearMes(String(label))}</p>
      {payload.map((serie) => (
        <p key={serie.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: serie.color }} />
          {serie.name}: <span className="font-medium tabular-nums">{formatearDinero(serie.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

/** Barras de ingresos vs. gastos por mes. */
export function GraficoFlujo({ datos }: { datos: FlujoMensual[] }) {
  const hayMovimientos = datos.some((mes) => Number(mes.ingresos) > 0 || Number(mes.gastos) > 0);
  if (!hayMovimientos) return <Vacio mensaje="Sin movimientos en los últimos meses" />;

  // Recharts necesita números; el backend envía los importes como texto.
  const filas = datos.map((mes) => ({
    mes_anio: mes.mes_anio,
    ingresos: Number(mes.ingresos),
    gastos: Number(mes.gastos),
  }));

  return (
    // text-tenue + "currentColor" hacen que ejes y rejilla sigan el tema.
    <div className="h-72 text-tenue">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filas} barGap={4} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} strokeDasharray="3 6" />
          <XAxis
            dataKey="mes_anio"
            tickFormatter={(mes: string) => formatearMes(mes, "corto")}
            tick={{ fill: "currentColor", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(valor: number) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(valor)}
            tick={{ fill: "currentColor", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<TooltipFlujo />} cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
          <Bar dataKey="ingresos" name="Ingresos" fill={COLOR_INGRESOS} radius={[8, 8, 2, 2]} maxBarSize={22} />
          <Bar dataKey="gastos" name="Gastos" fill={COLOR_GASTOS} radius={[8, 8, 2, 2]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
