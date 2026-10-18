import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { tasasApi } from "../../api/configuracion";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import type { Moneda } from "../../types";
import { formatearDinero, formatearFecha } from "../../utils/formato";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA_BASE } from "../ui/Campo";
import { Tarjeta } from "../ui/Tarjeta";
import { avisarError } from "./avisarError";

/** Una fila editable: "1 USD = [18.4655] MXN". */
function FilaTasa({ codigo }: { codigo: Moneda }) {
  const { moneda, tasas, recargarTasas, convertir } = useConfiguracion();
  const tasa = tasas.find((t) => t.moneda === codigo);
  const original = tasa ? String(Number(tasa.por_usd)) : "";
  const [valor, setValor] = useState(original);

  async function guardar() {
    await tasasApi.fijarManual(codigo, valor).then(recargarTasas).catch(avisarError);
  }

  const enPrincipal = codigo !== moneda ? convertir(1, codigo) : undefined;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
      <span className="flex items-center gap-2">
        1 USD =
        <input
          className={`${CLASE_ENTRADA_BASE} w-32 py-1 text-right font-mono`}
          type="number"
          step="0.000001"
          min="0.000001"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-label={`Tasa de ${codigo} por dólar`}
        />
        <span className="w-10 font-mono font-semibold">{codigo}</span>
      </span>
      {valor !== "" && valor !== original && (
        <Boton className="px-2.5 py-1 text-xs" onClick={guardar}>Guardar</Boton>
      )}
      <span className="flex-1 text-xs text-slate-500">
        {enPrincipal !== undefined && `1 ${codigo} ≈ ${formatearDinero(enPrincipal)} · `}
        {tasa ? `${formatearFecha(tasa.fecha)} · ${tasa.origen === "manual" ? "manual" : "internet"}` : "Sin tasa"}
      </span>
    </li>
  );
}

export function SeccionTasas() {
  const { monedasActivas, tasas, recargarTasas } = useConfiguracion();
  const [actualizando, setActualizando] = useState(false);
  const conTasa = monedasActivas.filter((m) => m !== "USD");

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
        Se descargan solas una vez al día. Si escribes una a mano, se usará la tuya en lugar de la de internet.
      </p>
      {conTasa.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">Con solo dólares activos no hace falta ninguna tasa.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {conTasa.map((codigo) => (
            // La key incluye la tasa: al recargarlas, la fila se reinicia con el valor nuevo.
            <FilaTasa key={`${codigo}-${tasas.find((t) => t.moneda === codigo)?.por_usd}`} codigo={codigo} />
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
