import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { tasasApi } from "../../api/configuracion";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import type { Moneda } from "../../types";
import { formatearFecha } from "../../utils/formato";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA_BASE } from "../ui/Campo";
import { Tarjeta } from "../ui/Tarjeta";
import { avisarError } from "./avisarError";

/** Muestra hasta 4 decimales sin ceros sobrantes: 20.7612, 0.05, 19. */
const legible = (valor: string) => String(Number(Number(valor).toFixed(4)));

/** Una fila editable: "1 EUR = [20.7612] MXN" (siempre respecto a la moneda principal). */
function FilaTasa({ codigo }: { codigo: Moneda }) {
  const { moneda: principal, tasas, recargarTasas } = useConfiguracion();
  const tasa = tasas.find((t) => t.moneda === codigo);
  const original = tasa ? legible(tasa.en_principal) : "";
  const [valor, setValor] = useState(original);

  async function guardar() {
    // El backend devuelve todas las tasas; recargamos para refrescar el contexto.
    await tasasApi.fijarManual(codigo, valor).then(recargarTasas).catch(avisarError);
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
      <span className="flex items-center gap-2">
        <span className="w-14 text-right">1 <span className="font-mono font-semibold">{codigo}</span> =</span>
        <input
          className={`${CLASE_ENTRADA_BASE} w-32 py-1 text-right font-mono`}
          type="number"
          step="any"
          min="0.000001"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-label={`Valor de 1 ${codigo} en ${principal}`}
        />
        <span className="w-10 font-mono font-semibold">{principal}</span>
      </span>
      {valor !== "" && valor !== original && (
        <Boton className="px-2.5 py-1 text-xs" onClick={guardar}>Guardar</Boton>
      )}
      <span className="flex-1 text-xs text-slate-500">
        {tasa ? `${formatearFecha(tasa.fecha)} · ${tasa.origen === "manual" ? "manual" : "internet"}` : "Sin tasa"}
      </span>
    </li>
  );
}

export function SeccionTasas() {
  const { moneda: principal, monedasActivas, tasas, recargarTasas } = useConfiguracion();
  const [actualizando, setActualizando] = useState(false);
  const otras = monedasActivas.filter((m) => m !== principal);

  async function actualizar() {
    setActualizando(true);
    await tasasApi.actualizarDesdeInternet().then(recargarTasas).catch(avisarError);
    setActualizando(false);
  }

  return (
    <Tarjeta
      titulo="Tasas de cambio"
      accion={
        <Boton variante="secundario" className="px-2.5 py-1.5 text-xs" onClick={actualizar} disabled={actualizando}>
          <RefreshCw size={14} className={actualizando ? "animate-spin" : ""} /> Actualizar
        </Boton>
      }
    >
      <p className="mb-2 text-sm text-slate-500">
        Cuánto vale cada moneda en tu moneda principal ({principal}). Se descargan solas una vez al día; si
        escribes una a mano, se usará la tuya.
      </p>
      {otras.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">Solo tienes activa tu moneda principal: no hace falta ninguna tasa.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {otras.map((codigo) => (
            // La key incluye la tasa: al recargarlas, la fila se reinicia con el valor nuevo.
            <FilaTasa key={`${codigo}-${principal}-${tasas.find((t) => t.moneda === codigo)?.en_principal}`} codigo={codigo} />
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-slate-400">
        <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="hover:underline">
          Tasas por ExchangeRate-API
        </a>
      </p>
    </Tarjeta>
  );
}
