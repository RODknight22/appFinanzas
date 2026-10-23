import { CheckCircle2, PiggyBank, RotateCcw, Wallet } from "lucide-react";

import type { Cuenta, Meta } from "../../types";
import { formatearDinero, formatearFecha, formatearMesEnFrase, formatearPorcentaje } from "../../utils/formato";
import { AccionesFila } from "../ui/AccionesFila";
import { Boton } from "../ui/Boton";
import { BarraMeta } from "./BarraMeta";

interface TarjetaMetaProps {
  meta: Meta;
  cuenta: Cuenta | undefined;
  onAportar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
  onMarcarCumplida: (cumplida: boolean) => void;
}

/** La frase que dice qué hacer: "Ahorra EUR 150 al mes hasta abril de 2027". */
function Consejo({ meta }: { meta: Meta }) {
  const dinero = (valor: string) => formatearDinero(valor, meta.moneda);
  if (meta.cumplida) {
    return (
      <p className="flex items-center gap-1.5 text-exito">
        <CheckCircle2 size={16} /> ¡Cumplida el {formatearFecha(meta.fecha_cumplida!)}!
      </p>
    );
  }
  if (meta.vencida) {
    return <p className="text-amber-600 dark:text-amber-400">La fecha límite ya pasó: faltan {dinero(meta.restante)}.</p>;
  }
  if (meta.ahorro_mensual && meta.fecha_limite) {
    return (
      <p>
        Faltan {dinero(meta.restante)}: ahorra <strong className="text-texto">{dinero(meta.ahorro_mensual)} al mes</strong>{" "}
        hasta {formatearMesEnFrase(meta.fecha_limite.slice(0, 7))}.
      </p>
    );
  }
  return <p>Faltan {dinero(meta.restante)}.</p>;
}

export function TarjetaMeta({ meta, cuenta, onAportar, onEditar, onEliminar, onMarcarCumplida }: TarjetaMetaProps) {
  const conCuenta = meta.cuenta_id !== null;
  return (
    <article className="flex flex-col gap-3 rounded-3xl bg-superficie p-5 shadow-[var(--sombra)] ring-1 ring-linea">
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-acento-50 text-2xl dark:bg-acento-950" aria-hidden>
          {meta.icono}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{meta.nombre}</h2>
          <p className="flex items-center gap-1 text-xs text-tenue">
            {conCuenta ? <Wallet size={12} /> : <PiggyBank size={12} />}
            {conCuenta ? `Saldo de ${cuenta?.nombre ?? "su cuenta"}` : "Con aportaciones"}
            {meta.fecha_limite && ` · hasta el ${formatearFecha(meta.fecha_limite)}`}
          </p>
        </div>
        <AccionesFila nombre={meta.nombre} onEditar={onEditar} onEliminar={onEliminar} />
      </header>

      <div>
        <BarraMeta meta={meta} />
        <p className="mt-1 text-right text-xs tabular-nums text-tenue">{formatearPorcentaje(meta.porcentaje)}</p>
      </div>

      <div className="text-sm text-suave">
        <Consejo meta={meta} />
      </div>

      <footer className="mt-auto flex flex-wrap gap-2">
        {/* Las metas con cuenta avanzan solas con su saldo: no tienen botón de aportar */}
        {!conCuenta && (
          <Boton variante={meta.cumplida ? "secundario" : "primario"} className="px-3 py-1.5 text-xs" onClick={onAportar}>
            <PiggyBank size={14} /> Aportaciones
          </Boton>
        )}
        {meta.cumplida ? (
          <Boton variante="fantasma" className="px-3 py-1.5 text-xs" onClick={() => onMarcarCumplida(false)}>
            <RotateCcw size={14} /> Reabrir
          </Boton>
        ) : (
          <Boton variante="fantasma" className="px-3 py-1.5 text-xs" onClick={() => onMarcarCumplida(true)}>
            <CheckCircle2 size={14} /> Marcar como cumplida
          </Boton>
        )}
      </footer>
    </article>
  );
}
