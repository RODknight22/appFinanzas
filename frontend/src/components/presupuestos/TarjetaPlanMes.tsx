import type { ReactNode } from "react";

import type { PlanMes } from "../../types";
import { formatearDinero, formatearPorcentaje } from "../../utils/formato";
import { vaAdelantado } from "../../utils/presupuestos";
import { Tarjeta } from "../ui/Tarjeta";

interface DatoProps {
  titulo: string;
  importe: string;
  /** Color del importe: los tokens `text-exito` / `text-peligro` o nada. */
  tono?: string;
  children?: ReactNode;
}

/** Un dato del plan: título, importe grande y el desglose debajo. */
function Dato({ titulo, importe, tono = "", children }: DatoProps) {
  return (
    <div className="min-w-0 rounded-2xl bg-superficie-2 px-4 py-3 ring-1 ring-linea">
      <dt className="text-xs font-medium text-tenue">{titulo}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums break-words ${tono}`}>{importe}</dd>
      {children && <dd className="mt-1 text-xs text-tenue break-words">{children}</dd>}
    </div>
  );
}

/** Une las partes que no son cero: "Recibido 250 € · Falta 500 €". */
function desglose(partes: [string, string][], moneda: PlanMes["moneda"]): string {
  return partes
    .filter(([, valor]) => Number(valor) !== 0)
    .map(([texto, valor]) => `${texto} ${formatearDinero(valor, moneda)}`)
    .join(" · ");
}

/**
 * "Plan del mes": qué entra, qué está comprometido (pagos fijos y presupuestos) y qué queda.
 * Todo en la moneda principal; el backend decide qué es real y qué está previsto.
 */
export function TarjetaPlanMes({ plan }: { plan: PlanMes }) {
  const dinero = (valor: string) => formatearDinero(valor, plan.moneda);
  const porAsignar = Number(plan.por_asignar);
  const disponible = Number(plan.disponible_real);
  const pasado = plan.estado === "pasado";
  const transcurrido = plan.porcentaje_mes_transcurrido;
  const conLimites = Number(plan.presupuestos_limite) > 0;

  return (
    <Tarjeta titulo="Plan del mes" className="mb-4">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Dato titulo={pasado ? "Entró" : "Entra este mes"} importe={dinero(plan.ingresos_esperados)}>
          {desglose(
            [["Recibido", plan.ingresos_reales], ["Falta", plan.ingresos_pendientes], ["Atrasado", plan.ingresos_atrasados]],
            plan.moneda,
          ) || "Sin ingresos fijos ni cobros este mes"}
        </Dato>

        <Dato titulo="Pagos fijos" importe={dinero(plan.pagos_fijos_total)}>
          {desglose(
            [["Pagado", plan.pagos_fijos_pagados], ["Falta", plan.pagos_fijos_pendientes], ["Atrasado", plan.pagos_fijos_atrasados]],
            plan.moneda,
          ) || "Ninguno este mes"}
          {Number(plan.pagos_fijos_en_presupuestos) > 0 && (
            <> ({dinero(plan.pagos_fijos_en_presupuestos)} ya van dentro de tus presupuestos)</>
          )}
        </Dato>

        <Dato titulo="Presupuestos" importe={dinero(plan.presupuestos_limite)}>
          {conLimites
            ? `Gastado ${dinero(plan.presupuestos_gastado)} (${formatearPorcentaje(plan.porcentaje_presupuesto_gastado)})`
            : "Sin presupuestos este mes"}
        </Dato>

        <Dato titulo="Por asignar" importe={dinero(plan.por_asignar)} tono={porAsignar < 0 ? "text-peligro" : "text-exito"}>
          {porAsignar < 0
            ? "Tu plan supera lo que entra: baja algún límite o algún pago fijo."
            : "Lo que entra menos pagos fijos y presupuestos."}
        </Dato>

        <Dato titulo={pasado ? "Te quedó" : "Te queda de verdad"} importe={dinero(plan.disponible_real)} tono={disponible < 0 ? "text-peligro" : ""}>
          Entró {dinero(plan.ingresos_reales)} · salió {dinero(plan.gastos_reales)}
        </Dato>

        <Dato titulo="Gastos sin presupuesto" importe={dinero(plan.sin_presupuesto_total)}>
          {plan.sin_presupuesto.length === 0 ? (
            "Nada fuera de tus presupuestos"
          ) : (
            <details>
              <summary className="cursor-pointer">Ver por categoría</summary>
              <ul className="mt-1 space-y-0.5">
                {plan.sin_presupuesto.map((gasto) => (
                  <li key={gasto.categoria_id} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: gasto.color }} />
                      <span className="truncate">{gasto.nombre}</span>
                    </span>
                    <span className="tabular-nums">{dinero(gasto.total)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Dato>
      </dl>

      {transcurrido !== null && conLimites && (
        <p className="mt-3 text-sm text-tenue">
          Ha pasado el <strong className="text-texto tabular-nums">{formatearPorcentaje(transcurrido)}</strong> del mes y has gastado el{" "}
          <strong className="text-texto tabular-nums">{formatearPorcentaje(plan.porcentaje_presupuesto_gastado)}</strong> de tus presupuestos
          {vaAdelantado(plan.porcentaje_presupuesto_gastado, transcurrido) ? (
            <span className="text-peligro">: vas adelantado.</span>
          ) : (
            <span className="text-exito">: vas a buen ritmo.</span>
          )}
        </p>
      )}
    </Tarjeta>
  );
}
