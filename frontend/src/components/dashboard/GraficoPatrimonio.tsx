import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";

import type { PuntoPatrimonio } from "../../types";
import { formatearDinero, formatearMes, formatearNumero } from "../../utils/formato";
import { Vacio } from "../ui/Estados";

function TooltipPatrimonio({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-superficie-2 px-3 py-2 text-xs shadow-lg ring-1 ring-linea">
      <p className="text-tenue">{formatearMes(String(label))}</p>
      <p className="font-semibold tabular-nums">{formatearDinero(payload[0].value ?? 0)}</p>
    </div>
  );
}

/** Evolución del dinero total mes a mes, con lo que ha crecido en el periodo. */
export function GraficoPatrimonio({ datos }: { datos: PuntoPatrimonio[] }) {
  // useId da ":r1:"; los ":" no son válidos dentro de url(#…) en todos los navegadores.
  const id = useId().replace(/:/g, "");
  const filas = datos.map((p) => ({ mes_anio: p.mes_anio, total: Number(p.total) }));
  if (filas.every((f) => f.total === 0)) return <Vacio mensaje="Añade cuentas para ver cómo crece tu dinero" />;

  const inicial = filas[0].total;
  const actual = filas[filas.length - 1].total;
  const cambio = actual - inicial;
  const porcentaje = inicial !== 0 ? (cambio / Math.abs(inicial)) * 100 : null;
  const sube = cambio >= 0;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-3xl font-bold tracking-tight tabular-nums">{formatearDinero(actual)}</p>
        <p className={`text-sm font-semibold ${sube ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {sube ? "+" : "−"}
          {formatearDinero(Math.abs(cambio))}
          {porcentaje !== null && ` (${formatearNumero(Math.abs(porcentaje), 1)} %)`}
          <span className="font-normal text-tenue"> en {filas.length} meses</span>
        </p>
      </div>
      {/* text-acento-500 → currentColor: la línea sigue el color de acento elegido */}
      <div className="min-h-48 flex-1 text-acento-500">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filas} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="mes_anio"
              tickFormatter={(mes: string) => formatearMes(mes, "corto")}
              tick={{ fill: "var(--tenue)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            {/* Eje oculto pero sin empezar en 0: así se aprecian los cambios */}
            <YAxis hide domain={["dataMin - 100", "dataMax + 100"]} />
            <Tooltip content={<TooltipPatrimonio />} cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }} />
            <Area type="monotone" dataKey="total" stroke="currentColor" strokeWidth={2.5} fill={`url(#${id})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
