import { CalendarClock, Sparkles } from "lucide-react";

import type { Cuenta } from "../../types";
import { proximaFechaDelDia, rendimientoEstimado } from "../../utils/cuentas";
import { diasHasta, formatearDinero, formatearFecha, textoVencimiento } from "../../utils/formato";
import { TIPOS_CUENTA } from "../formularios/FormularioCuenta";
import { AccionesFila } from "../ui/AccionesFila";
import { Boton } from "../ui/Boton";

interface FilaCuentaProps {
  cuenta: Cuenta;
  saldo: number;
  onEditar: () => void;
  onEliminar: () => void;
  onRegistrarRendimientos: () => void;
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

function DetalleCredito({ cuenta, saldo }: { cuenta: Cuenta; saldo: number }) {
  const deuda = Math.max(-saldo, 0); // en una tarjeta, saldo negativo = deuda
  const limite = cuenta.limite_credito ? Number(cuenta.limite_credito) : null;
  const usado = limite ? Math.min((deuda / limite) * 100, 100) : 0;

  return (
    <div className="mt-2 space-y-2 text-xs text-slate-500">
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <CalendarClock size={14} className="shrink-0" />
        {cuenta.dia_corte && <FechaTarjeta etiqueta="Corte" dia={cuenta.dia_corte} />}
        {cuenta.dia_pago && <FechaTarjeta etiqueta="Pago" dia={cuenta.dia_pago} />}
      </p>
      {limite && (
        <div className="max-w-sm">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full ${usado >= 80 ? "bg-rose-500" : "bg-sky-500"}`}
              style={{ width: `${usado}%` }}
            />
          </div>
          <p className="mt-1">
            Disponible {formatearDinero(Math.max(limite - deuda, 0))} de {formatearDinero(limite)} ({Math.round(usado)}% usado)
          </p>
        </div>
      )}
    </div>
  );
}

function DetalleRendimientos({ cuenta, saldo, onRegistrar }: { cuenta: Cuenta; saldo: number; onRegistrar: () => void }) {
  const tasa = Number(cuenta.tasa_rendimiento_anual);
  const diasPendientes = cuenta.fecha_ultimo_rendimiento ? -diasHasta(cuenta.fecha_ultimo_rendimiento) : 0;
  const pendiente = rendimientoEstimado(saldo, tasa, diasPendientes);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
      <span>
        {tasa}% anual · ≈ {formatearDinero(rendimientoEstimado(saldo, tasa, 1))} al día · ≈{" "}
        {formatearDinero(rendimientoEstimado(saldo, tasa, 30))} al mes
      </span>
      {diasPendientes > 0 ? (
        <Boton variante="secundario" className="px-2.5 py-1 text-xs" onClick={onRegistrar}>
          <Sparkles size={14} /> Registrar {diasPendientes} día{diasPendientes === 1 ? "" : "s"} (≈ {formatearDinero(pendiente)})
        </Boton>
      ) : (
        <span className="text-emerald-600 dark:text-emerald-400">Rendimientos registrados hasta hoy</span>
      )}
    </div>
  );
}

/** Una cuenta de la lista, con la información propia de su tipo. */
export function FilaCuenta({ cuenta, saldo, onEditar, onEliminar, onRegistrarRendimientos }: FilaCuentaProps) {
  const { etiqueta, icono: Icono } = TIPOS_CUENTA[cuenta.tipo];
  const esCredito = cuenta.tipo === "credito";

  return (
    <li className="flex items-start gap-4 py-4">
      <span className="rounded-xl bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Icono size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{cuenta.nombre}</p>
        <p className="text-xs text-slate-500">{etiqueta}</p>
        {esCredito && <DetalleCredito cuenta={cuenta} saldo={saldo} />}
        {cuenta.tipo === "rendimientos" && (
          <DetalleRendimientos cuenta={cuenta} saldo={saldo} onRegistrar={onRegistrarRendimientos} />
        )}
      </div>
      <div className="text-right">
        <p className="text-xs text-slate-500">{esCredito ? "Deuda" : "Saldo actual"}</p>
        <p className={`font-semibold tabular-nums ${esCredito && saldo < 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>
          {formatearDinero(esCredito ? Math.max(-saldo, 0) : saldo)}
        </p>
      </div>
      <AccionesFila onEditar={onEditar} onEliminar={onEliminar} />
    </li>
  );
}
