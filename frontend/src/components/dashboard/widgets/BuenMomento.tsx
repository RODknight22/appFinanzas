import type { BuenMomento as DatosBuenMomento } from "../../../types";
import { formatearNumero, formatearPorcentaje } from "../../../utils/formato";
import { Vacio } from "../../ui/Estados";

const VEREDICTOS = {
  bueno: { titulo: "Buen momento para cambiar", clase: "bg-ingreso/15 text-ingreso" },
  normal: { titulo: "Un momento normal", clase: "bg-superficie-2 text-suave" },
  malo: { titulo: "Mejor esperar, si puedes", clase: "bg-gasto/15 text-gasto" },
} as const;

/** Posición (0-100 %) de `valor` dentro de [min, max]; en el centro si no hay rango. */
function posicion(valor: number, min: number, max: number): number {
  return max > min ? ((valor - min) / (max - min)) * 100 : 50;
}

/**
 * ¿Está hoy barata la moneda en la que gastas? La tasa de hoy frente a su media y su rango de
 * los últimos 90 días. No predice: compara con lo reciente.
 */
export function BuenMomento({ datos }: { datos: DatosBuenMomento }) {
  const { moneda_ingreso: de, moneda_gasto: a, tasa_hoy, tasa_media, tasa_minima, tasa_maxima, veredicto } = datos;
  if (!de || !a) return <Vacio mensaje="Aparece cuando cobras en una moneda y gastas en otra" />;
  if (!veredicto || !tasa_hoy || !tasa_media || !tasa_minima || !tasa_maxima) {
    return <Vacio mensaje={`Aún no hay tasas de ${datos.dias ?? 90} días para comparar ${de} y ${a}`} />;
  }

  const [hoy, media, min, max] = [tasa_hoy, tasa_media, tasa_minima, tasa_maxima].map(Number);
  const rinde = Number(datos.rinde_porcentaje ?? 0);
  const { titulo, clase } = VEREDICTOS[veredicto];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${clase}`}>{titulo}</span>
        <span className="text-xs text-tenue tabular-nums">
          {rinde === 0 ? "Igual que" : `${formatearPorcentaje(Math.abs(rinde))} ${rinde > 0 ? "mejor" : "peor"} que`} la media
        </span>
      </div>

      <p className="text-2xl font-bold tabular-nums">
        1 {a} = {formatearNumero(hoy, 2)} {de}
      </p>

      {/* El rango de los 90 días: a la izquierda, lo más barato (mejor para cambiar). */}
      <div>
        <div className="relative h-2 rounded-full bg-linear-to-r from-ingreso/40 via-superficie-2 to-gasto/40">
          <span
            className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tenue"
            style={{ left: `${posicion(media, min, max)}%` }}
            title={`Media: ${formatearNumero(media, 2)} ${de}`}
          />
          <span
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-acento-500 ring-2 ring-superficie"
            style={{ left: `${posicion(hoy, min, max)}%` }}
            title={`Hoy: ${formatearNumero(hoy, 2)} ${de}`}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-tenue tabular-nums">
          <span>{formatearNumero(min, 2)}</span>
          <span>media {formatearNumero(media, 2)}</span>
          <span>{formatearNumero(max, 2)}</span>
        </div>
      </div>
      <p className="text-xs text-tenue">
        {de} por cada {a} en los últimos {datos.dias} días. Compara con lo reciente: no adivina hacia dónde irá.
      </p>
    </div>
  );
}
