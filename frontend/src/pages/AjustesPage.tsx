import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { tasasApi } from "../api/configuracion";
import { Boton } from "../components/ui/Boton";
import { CLASE_ENTRADA_BASE } from "../components/ui/Campo";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Tarjeta } from "../components/ui/Tarjeta";
import { MONEDAS } from "../config";
import { useConfiguracion } from "../hooks/useConfiguracion";
import type { Moneda } from "../types";
import { formatearDinero, formatearFecha } from "../utils/formato";

const TODAS = Object.keys(MONEDAS) as Moneda[];

function avisarError(e: unknown) {
  window.alert(e instanceof Error ? e.message : String(e));
}

/** Activar/desactivar monedas y elegir la principal. */
function SeccionMonedas() {
  const { moneda, monedasActivas, actualizarConfiguracion } = useConfiguracion();

  async function alternarActiva(codigo: Moneda) {
    const activas = monedasActivas.includes(codigo)
      ? monedasActivas.filter((m) => m !== codigo)
      : [...monedasActivas, codigo];
    await actualizarConfiguracion({ monedas_activas: activas }).catch(avisarError);
  }

  async function elegirPrincipal(codigo: Moneda) {
    const aviso =
      `¿Usar ${codigo} como moneda principal?\n\n` +
      "Los totales, gráficos y presupuestos pasarán a mostrarse en esta moneda. " +
      "Cada transacción se reconvertirá con la tasa de su fecha.";
    if (!window.confirm(aviso)) return;
    await actualizarConfiguracion({ moneda: codigo }).catch(avisarError);
  }

  return (
    <Tarjeta titulo="Monedas">
      <p className="mb-4 text-sm text-slate-500">
        Las monedas activas aparecen en los formularios. La principal es en la que se suman los totales.
      </p>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {TODAS.map((codigo) => {
          const activa = monedasActivas.includes(codigo);
          const esPrincipal = codigo === moneda;
          return (
            <li key={codigo} className="flex items-center gap-4 py-3">
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-600"
                  checked={activa}
                  // La principal no se puede desactivar (el backend también lo impide).
                  disabled={esPrincipal}
                  onChange={() => alternarActiva(codigo)}
                />
                <span className="w-12 font-mono text-sm font-semibold">{codigo}</span>
                <span className="text-sm text-slate-600 dark:text-slate-400">{MONEDAS[codigo].nombre}</span>
              </label>
              {esPrincipal ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Principal
                </span>
              ) : (
                activa && (
                  <button type="button" onClick={() => elegirPrincipal(codigo)} className="text-xs font-medium text-emerald-600 hover:underline">
                    Hacer principal
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}

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

function SeccionTasas() {
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

export function AjustesPage() {
  return (
    <>
      <EncabezadoPagina titulo="Ajustes" descripcion="Monedas, tasas de cambio y preferencias" />
      <div className="grid gap-6 lg:grid-cols-2">
        <SeccionMonedas />
        <SeccionTasas />
      </div>
    </>
  );
}
