import { CalendarClock, ChevronRight, CornerDownRight, CreditCard, Pin, PinOff, Sparkles } from "lucide-react";

import type { Cuenta } from "../../types";
import { proximaFechaDelDia, rendimientoEstimado } from "../../utils/cuentas";
import { diasHasta, formatearDinero, formatearFecha, formatearPorcentaje, textoVencimiento } from "../../utils/formato";
import { TIPOS_CUENTA } from "../formularios/FormularioCuenta";
import { AccionesFila } from "../ui/AccionesFila";
import { Boton } from "../ui/Boton";

export interface FilaCuentaProps {
  cuenta: Cuenta;
  saldo: number;
  onEditar: () => void;
  onEliminar: () => void;
  /** Si no se puede borrar (p. ej. tiene subcuentas), por qué: el botón se apaga y lo explica. */
  motivoNoEliminar?: string;
  onRegistrarRendimientos: () => void;
  /** Abre una transferencia hacia la tarjeta con la deuda ya escrita. */
  onPagar: () => void;
  onFijar: () => void;
  /** Se pinta sangrada, debajo de su cuenta madre. */
  subcuenta?: boolean;
  /** Solo en una cuenta madre: su saldo más el de sus subcuentas, en la moneda principal. */
  totalConSubcuentas?: number;
  /** Solo en una cuenta madre: la flecha para mostrar u ocultar sus subcuentas. */
  plegado?: { plegada: boolean; cantidad: number; onAlternar: () => void };
}

/** Fecha de corte/pago con aviso de cuánto falta: "15 oct 2026 · En 3 días". */
function FechaTarjeta({ etiqueta, dia }: { etiqueta: string; dia: number }) {
  const fecha = proximaFechaDelDia(dia);
  const urgente = diasHasta(fecha) <= 3;
  return (
    <span className={urgente ? "text-amber-600 dark:text-amber-400" : ""}>
      {etiqueta}: {formatearFecha(fecha)} ({textoVencimiento(fecha).toLowerCase()})
    </span>
  );
}

function DetalleCredito({ cuenta, saldo, onPagar }: { cuenta: Cuenta; saldo: number; onPagar: () => void }) {
  const deuda = Math.max(-saldo, 0); // en una tarjeta, saldo negativo = deuda
  const limite = cuenta.limite_credito ? Number(cuenta.limite_credito) : null;
  const usado = limite ? Math.min((deuda / limite) * 100, 100) : 0;

  return (
    <div className="mt-2 space-y-2 text-xs text-tenue">
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <CalendarClock size={14} className="shrink-0" />
        {cuenta.dia_corte && <FechaTarjeta etiqueta="Corte" dia={cuenta.dia_corte} />}
        {cuenta.dia_pago && <FechaTarjeta etiqueta="Pago" dia={cuenta.dia_pago} />}
      </p>
      {limite && (
        <div className="max-w-sm">
          <div className="h-1.5 overflow-hidden rounded-full bg-superficie-2">
            <div
              className={`h-full rounded-full ${usado >= 80 ? "bg-rose-500" : "bg-sky-500"}`}
              style={{ width: `${usado}%` }}
            />
          </div>
          <p className="mt-1">
            Disponible {formatearDinero(Math.max(limite - deuda, 0), cuenta.moneda)} de {formatearDinero(limite, cuenta.moneda)} ({formatearPorcentaje(usado, 0)} usado)
          </p>
        </div>
      )}
      {deuda > 0 && (
        <Boton variante="secundario" className="px-2.5 py-1 text-xs" onClick={onPagar}>
          <CreditCard size={14} /> Pagar tarjeta
        </Boton>
      )}
    </div>
  );
}

function DetalleRendimientos({ cuenta, saldo, onRegistrar }: { cuenta: Cuenta; saldo: number; onRegistrar: () => void }) {
  const tasa = Number(cuenta.tasa_rendimiento_anual);
  const diasPendientes = cuenta.fecha_ultimo_rendimiento ? -diasHasta(cuenta.fecha_ultimo_rendimiento) : 0;
  const pendiente = rendimientoEstimado(saldo, tasa, diasPendientes);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-tenue">
      <span>
        {formatearPorcentaje(tasa, 2)} anual · ≈ {formatearDinero(rendimientoEstimado(saldo, tasa, 1), cuenta.moneda)} al día · ≈{" "}
        {formatearDinero(rendimientoEstimado(saldo, tasa, 30), cuenta.moneda)} al mes
      </span>
      {diasPendientes > 0 ? (
        <Boton variante="secundario" className="px-2.5 py-1 text-xs" onClick={onRegistrar}>
          <Sparkles size={14} /> Registrar {diasPendientes} día{diasPendientes === 1 ? "" : "s"} (≈ {formatearDinero(pendiente, cuenta.moneda)})
        </Boton>
      ) : (
        <span className="text-emerald-600 dark:text-emerald-400">Rendimientos registrados hasta hoy</span>
      )}
    </div>
  );
}

/** Una cuenta de la lista, con la información propia de su tipo. */
export function FilaCuenta(props: FilaCuentaProps) {
  const { cuenta, saldo, onEditar, onEliminar, motivoNoEliminar, onRegistrarRendimientos, onPagar, onFijar, subcuenta = false, totalConSubcuentas, plegado } = props;
  const { etiqueta, icono: Icono } = TIPOS_CUENTA[cuenta.tipo];
  const esCredito = cuenta.tipo === "credito";
  const IconoFijar = cuenta.fijada ? PinOff : Pin;

  return (
    <li className={subcuenta ? "py-3 pl-6 sm:pl-10" : "py-4"}>
      <div className="flex items-start gap-3 sm:gap-4">
        {subcuenta && <CornerDownRight size={16} className="mt-3 -mr-1 shrink-0 text-tenue-2 sm:-mr-2" aria-hidden />}
        {/* Hueco fijo para la flecha en todas las cuentas madre: así los nombres quedan en la
            misma columna tengan subcuentas o no. */}
        {!subcuenta && (
          <span className="flex w-6 shrink-0 justify-center">
            {plegado && (
              <button
                type="button"
                onClick={plegado.onAlternar}
                aria-expanded={!plegado.plegada}
                aria-label={`${plegado.plegada ? "Mostrar" : "Ocultar"} ${plegado.cantidad} subcuentas`}
                title={`${plegado.plegada ? "Mostrar" : "Ocultar"} subcuentas (${plegado.cantidad})`}
                className="flex min-h-10 w-full flex-col items-center justify-center rounded-lg text-tenue-2 transition-colors hover:bg-realce hover:text-texto"
              >
                <ChevronRight size={16} className={`transition-transform ${plegado.plegada ? "" : "rotate-90"}`} />
                {plegado.plegada && <span className="text-[10px] font-semibold leading-none tabular-nums">{plegado.cantidad}</span>}
              </button>
            )}
          </span>
        )}
        <span className="rounded-xl bg-superficie-2 p-2.5 text-suave">
          <Icono size={subcuenta ? 16 : 20} />
        </span>
        {/* En móvil el saldo va debajo del nombre: en una sola fila no caben ambos. */}
        <div className="min-w-0 flex-1 sm:flex sm:items-start sm:gap-4">
          <div className="min-w-0 sm:flex-1">
            <p className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{cuenta.nombre}</span>
              {cuenta.fijada && <Pin size={13} className="shrink-0 fill-current text-acento-600 dark:text-acento-400" aria-label="Fijada" />}
            </p>
            <p className="truncate text-xs text-tenue">
              {etiqueta} · {cuenta.moneda}
              {cuenta.numero_cuenta && <span className="font-mono"> · {cuenta.numero_cuenta}</span>}
            </p>
          </div>
          <div className="mt-1 sm:mt-0 sm:text-right">
            <p className="hidden text-xs text-tenue sm:block">{esCredito ? "Deuda" : "Saldo actual"}</p>
            <p className={`font-semibold tabular-nums ${esCredito && saldo < 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>
              {esCredito && <span className="text-xs font-normal text-tenue sm:hidden">Deuda </span>}
              {formatearDinero(esCredito ? Math.max(-saldo, 0) : saldo, cuenta.moneda)}
            </p>
            {totalConSubcuentas !== undefined && (
              <p className="text-xs text-tenue tabular-nums">Con subcuentas ≈ {formatearDinero(totalConSubcuentas)}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onFijar}
            aria-label={cuenta.fijada ? "Dejar de fijar" : "Fijar arriba"}
            title={cuenta.fijada ? "Dejar de fijar" : "Fijar arriba"}
            className="rounded-lg p-1.5 text-tenue-2 transition-colors hover:bg-realce hover:text-texto"
          >
            <IconoFijar size={16} />
          </button>
          <AccionesFila nombre={cuenta.nombre} onEditar={onEditar} onEliminar={onEliminar} motivoNoEliminar={motivoNoEliminar} />
        </div>
      </div>
      {/* Detalles debajo y alineados con el nombre (pl-14 = icono + hueco; pl-24 suma la columna
          de la flecha): así en móvil usan todo el ancho en vez de una columna estrecha. */}
      <div className={subcuenta ? "sm:pl-14" : "sm:pl-24"}>
        {esCredito && <DetalleCredito cuenta={cuenta} saldo={saldo} onPagar={onPagar} />}
        {cuenta.tipo === "rendimientos" && (
          <DetalleRendimientos cuenta={cuenta} saldo={saldo} onRegistrar={onRegistrarRendimientos} />
        )}
      </div>
    </li>
  );
}
