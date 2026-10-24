import { ArrowRightLeft, Banknote, Trophy } from "lucide-react";

import type { ViasEnvio } from "../../types";
import { formatearDinero, formatearPorcentaje } from "../../utils/formato";

/** Una frase con la conclusión: por dónde sale más barato y cuánto más cuesta la siguiente. */
function conclusion({ vias }: ViasEnvio): string {
  const [mejor, segunda] = vias;
  if (!segunda) {
    return "Cuando envíes por otra vía (otra cuenta o sacando del cajero) e indiques lo que llegó, aquí verás cuál te conviene.";
  }
  const nombre = (via: typeof mejor) => (via.a_efectivo ? `sacando efectivo a «${via.destino}»` : `a «${via.destino}»`);
  return `Te sale más barato ${nombre(mejor)}: ${formatearPorcentaje(Number(mejor.porcentaje_medio))} frente a ${formatearPorcentaje(Number(segunda.porcentaje_medio))} ${nombre(segunda)}.`;
}

/** Lo que costó cada vía de envío entre monedas en el último año, de la más barata a la más cara. */
export function ComparadorVias({ datos }: { datos: ViasEnvio }) {
  const { vias, moneda } = datos;
  return (
    <div className="space-y-3">
      <p className="text-sm text-suave">{conclusion(datos)}</p>
      <ul className="divide-y divide-linea">
        {vias.map((via, i) => {
          const Icono = via.a_efectivo ? Banknote : ArrowRightLeft;
          return (
            <li key={`${via.cuenta_origen_id}-${via.cuenta_destino_id}`} className="flex items-center gap-3 py-3">
              <span className="rounded-xl bg-superficie-2 p-2 text-suave">
                <Icono size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                  <span className="truncate">{via.origen} → {via.destino}</span>
                  {i === 0 && vias.length > 1 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-exito/15 px-2 py-0.5 text-xs font-semibold text-exito">
                      <Trophy size={12} /> La más barata
                    </span>
                  )}
                </p>
                <p className="text-xs text-tenue">
                  {via.a_efectivo ? "Cajero" : "Transferencia"} · {via.envios} {via.envios === 1 ? "envío" : "envíos"} · {formatearDinero(via.enviado, moneda)} enviados
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{formatearPorcentaje(Number(via.porcentaje_medio))}</p>
                <p className="text-xs text-tenue tabular-nums">{formatearDinero(via.coste, moneda)}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-tenue">
        Coste frente a la tasa oficial del BCE de cada día, comisiones incluidas. Solo cuentan los envíos en los que indicaste lo que llegó.
      </p>
    </div>
  );
}
