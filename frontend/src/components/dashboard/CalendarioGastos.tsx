import type { GastoDiario, MesAnio } from "../../types";
import { formatearDinero, formatearFecha, hoyISO, rangoDelMes } from "../../utils/formato";

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
// Clases completas (Tailwind solo genera las que aparecen escritas tal cual en el código).
const NIVELES = ["bg-superficie-2", "bg-acento-500/20", "bg-acento-500/40", "bg-acento-500/65", "bg-acento-500/90"];

/** Fechas ISO desde `desde` hasta `hasta` (incluidas). */
function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const [a, m, d] = desde.split("-").map(Number);
  for (let fecha = new Date(a, m - 1, d, 12); ; fecha.setDate(fecha.getDate() + 1)) {
    const iso = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
    if (iso > hasta) return dias;
    dias.push(iso);
  }
}

/** Intensidad 1-4 según lo cerca que esté del día de más gasto (0 = sin gasto). */
function nivel(total: number, maximo: number): number {
  if (total <= 0) return 0;
  return Math.min(4, Math.ceil((total / maximo) * 4));
}

/** Mapa de calor del mes: cada día más intenso cuanto más se gastó. */
export function CalendarioGastos({ mes, datos }: { mes: MesAnio; datos: GastoDiario[] }) {
  const { desde, hasta } = rangoDelMes(mes);
  const hoy = hoyISO();
  const porDia = new Map(datos.map((d) => [d.fecha, Number(d.total)]));
  const dias = diasEntre(desde, hasta);
  const maximo = Math.max(1, ...porDia.values());
  // Huecos antes del primer día para que caiga en su día de la semana (lunes primero).
  const [a, m, d] = desde.split("-").map(Number);
  const huecos = (new Date(a, m - 1, d).getDay() + 6) % 7;

  const transcurridos = dias.filter((dia) => dia <= hoy);
  const total = [...porDia.values()].reduce((suma, v) => suma + v, 0);
  const sinGastos = transcurridos.filter((dia) => !porDia.has(dia)).length;
  const masCaro = datos.reduce<GastoDiario | null>((max, dia) => (!max || Number(dia.total) > Number(max.total) ? dia : max), null);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {DIAS_SEMANA.map((letra) => (
          <span key={letra} className="text-[11px] font-semibold text-tenue-2">{letra}</span>
        ))}
        {Array.from({ length: huecos }, (_, i) => <span key={`hueco-${i}`} />)}
        {dias.map((dia) => {
          const gasto = porDia.get(dia) ?? 0;
          const futuro = dia > hoy;
          return (
            <div
              key={dia}
              title={`${formatearFecha(dia)}: ${gasto ? formatearDinero(gasto) : "sin gastos"}`}
              // Altura fija (no cuadradas): con todo el ancho, unas celdas cuadradas harían el widget enorme.
              className={`flex h-8 items-center justify-center rounded-lg text-[11px] font-medium transition-transform hover:scale-110 ${
                NIVELES[nivel(gasto, maximo)]
              } ${futuro ? "opacity-35" : ""} ${dia === hoy ? "ring-2 ring-acento-400" : ""} ${nivel(gasto, maximo) >= 3 ? "text-white" : "text-tenue"}`}
            >
              {Number(dia.slice(8))}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-tenue">
        <span>
          {formatearDinero(total)} en {transcurridos.length} días
          {masCaro && ` · el más caro, el ${Number(masCaro.fecha.slice(8))} (${formatearDinero(masCaro.total)})`}
        </span>
        <span className="flex items-center gap-1" aria-hidden>
          Menos {NIVELES.map((clase) => <span key={clase} className={`h-3 w-3 rounded ${clase}`} />)} Más
        </span>
      </div>
      {sinGastos > 0 && (
        <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          🎉 {sinGastos} {sinGastos === 1 ? "día" : "días"} sin gastar nada este mes
        </p>
      )}
    </div>
  );
}
