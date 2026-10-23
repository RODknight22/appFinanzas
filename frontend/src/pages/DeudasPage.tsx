import { ChevronDown, HandCoins, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { cuentasApi, deudasApi } from "../api/recursos";
import { FormularioAbono } from "../components/formularios/FormularioAbono";
import { FormularioDeuda } from "../components/formularios/FormularioDeuda";
import { AccionesFila } from "../components/ui/AccionesFila";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido, Vacio } from "../components/ui/Estados";
import { Modal } from "../components/ui/Modal";
import { Tarjeta } from "../components/ui/Tarjeta";
import { TotalConvertido } from "../components/ui/TotalConvertido";
import { useConfiguracion } from "../hooks/useConfiguracion";
import { confirmarYEliminar } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import type { Cuenta, Deuda, SentidoDeuda } from "../types";
import { sumarConvertidos } from "../utils/divisas";
import { formatearDinero, formatearFecha, textoVencimiento } from "../utils/formato";

type EstadoModal = null | { modo: "nueva" } | { modo: "editar"; deuda: Deuda } | { modo: "abonar"; deuda: Deuda };

const PESTANAS: Record<SentidoDeuda, { titulo: string; vacio: string; total: string }> = {
  me_deben: { titulo: "Me deben", vacio: "Nadie te debe dinero", total: "Te deben" },
  debo: { titulo: "Debo", vacio: "No le debes dinero a nadie", total: "Debes" },
};

export function DeudasPage() {
  const [sentido, setSentido] = useState<SentidoDeuda>("me_deben");
  const [verSaldadas, setVerSaldadas] = useState(false);
  const [modal, setModal] = useState<EstadoModal>(null);
  const { convertir } = useConfiguracion();
  const estado = useDatos(() => Promise.all([deudasApi.listar(), cuentasApi.listar()]), [], "deudas");

  function alGuardar() {
    setModal(null);
    estado.recargar();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Deudas"
        consejo="Si eliges una cuenta, prestar resta de su saldo y cada abono lo devuelve, como una transferencia: no cuenta como gasto ni ingreso. Sin cuenta, la deuda es solo un apunte."
        descripcion="Quién te debe y a quién le debes"
        acciones={<Boton onClick={() => setModal({ modo: "nueva" })}><Plus size={16} /> Nueva</Boton>}
      />

      <Contenido {...estado} onReintentar={estado.recargar}>
        {([deudas, cuentas]) => {
          const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
          // Pendiente total de cada lado, en la moneda principal (tasa de hoy).
          const pendiente = (lado: SentidoDeuda) =>
            sumarConvertidos(
              deudas.filter((d) => d.sentido === lado).map((d) => ({ monto: Number(d.pendiente), moneda: d.moneda })),
              convertir,
            );
          const visibles = deudas.filter((d) => d.sentido === sentido && (verSaldadas || d.fecha_saldada === null));
          const saldadas = deudas.filter((d) => d.sentido === sentido && d.fecha_saldada !== null).length;

          return (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3">
                {(Object.keys(PESTANAS) as SentidoDeuda[]).map((lado) => (
                  <button
                    key={lado}
                    type="button"
                    onClick={() => setSentido(lado)}
                    aria-pressed={sentido === lado}
                    className={`rounded-3xl p-5 text-left ring-1 transition ${
                      sentido === lado ? "bg-superficie shadow-[var(--sombra)] ring-acento-500" : "bg-superficie/60 ring-linea hover:bg-superficie"
                    }`}
                  >
                    <p className="text-sm font-semibold text-tenue">{PESTANAS[lado].titulo}</p>
                    <p className={`mt-1 text-2xl font-bold tabular-nums ${lado === "me_deben" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      <TotalConvertido suma={pendiente(lado)} />
                    </p>
                  </button>
                ))}
              </div>

              <Tarjeta
                titulo={PESTANAS[sentido].titulo}
                accion={
                  saldadas > 0 && (
                    <Boton variante="fantasma" className="px-2 py-1 text-xs" onClick={() => setVerSaldadas((v) => !v)}>
                      {verSaldadas ? "Ocultar saldadas" : `Ver saldadas (${saldadas})`}
                    </Boton>
                  )
                }
              >
                {visibles.length === 0 ? (
                  <Vacio mensaje={PESTANAS[sentido].vacio} />
                ) : (
                  <ul className="divide-y divide-linea">
                    {visibles.map((deuda) => (
                      <FilaDeuda
                        key={deuda.id}
                        deuda={deuda}
                        cuentaPorId={cuentaPorId}
                        onAbonar={() => setModal({ modo: "abonar", deuda })}
                        onEditar={() => setModal({ modo: "editar", deuda })}
                        onEliminar={() =>
                          confirmarYEliminar(
                            `¿Eliminar la deuda con ${deuda.persona}? Se borrarán también sus abonos y los saldos volverán a como estaban.`,
                            () => deudasApi.eliminar(deuda.id),
                            estado.recargar,
                          )
                        }
                        onEliminarAbono={(abonoId) =>
                          confirmarYEliminar("¿Eliminar este abono?", () => deudasApi.eliminarAbono(deuda.id, abonoId), estado.recargar)
                        }
                      />
                    ))}
                  </ul>
                )}
              </Tarjeta>

              <Modal
                titulo={modal?.modo === "abonar" ? "Registrar abono" : modal?.modo === "editar" ? "Editar deuda" : "Nueva deuda"}
                abierto={modal !== null}
                onCerrar={() => setModal(null)}
              >
                {modal?.modo === "abonar" && (
                  <FormularioAbono key={modal.deuda.id} deuda={modal.deuda} cuentas={cuentas} onGuardado={alGuardar} onCancelar={() => setModal(null)} />
                )}
                {(modal?.modo === "nueva" || modal?.modo === "editar") && (
                  <FormularioDeuda
                    key={modal.modo === "editar" ? modal.deuda.id : "nueva"}
                    inicial={modal.modo === "editar" ? modal.deuda : undefined}
                    sentidoInicial={sentido}
                    cuentas={cuentas}
                    onGuardado={alGuardar}
                    onCancelar={() => setModal(null)}
                  />
                )}
              </Modal>
            </>
          );
        }}
      </Contenido>
    </>
  );
}

interface FilaDeudaProps {
  deuda: Deuda;
  cuentaPorId: Map<number, Cuenta>;
  onAbonar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
  onEliminarAbono: (abonoId: number) => void;
}

function FilaDeuda({ deuda, cuentaPorId, onAbonar, onEditar, onEliminar, onEliminarAbono }: FilaDeudaProps) {
  const [abierta, setAbierta] = useState(false);
  const porcentaje = Math.min(100, (Number(deuda.abonado) / Number(deuda.monto)) * 100);
  const saldada = deuda.fecha_saldada !== null;

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{deuda.persona}</p>
          <p className="text-xs text-tenue">
            {formatearFecha(deuda.fecha)}
            {deuda.cuenta_id !== null && ` · ${cuentaPorId.get(deuda.cuenta_id)?.nombre ?? ""}`}
            {deuda.notas && ` · ${deuda.notas}`}
          </p>
          {saldada ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Saldada el {formatearFecha(deuda.fecha_saldada!)}</p>
          ) : (
            deuda.fecha_vencimiento && (
              <p className={`text-xs ${deuda.vencida ? "text-amber-600 dark:text-amber-400" : "text-tenue"}`}>
                Vence: {formatearFecha(deuda.fecha_vencimiento)} ({textoVencimiento(deuda.fecha_vencimiento).toLowerCase()})
              </p>
            )
          )}
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{formatearDinero(deuda.pendiente, deuda.moneda)}</p>
          <p className="text-xs text-tenue tabular-nums">de {formatearDinero(deuda.monto, deuda.moneda)}</p>
        </div>
        <div className="flex items-center gap-1">
          {!saldada && (
            <Boton variante="secundario" className="px-2.5 py-1.5 text-xs" onClick={onAbonar}>
              <HandCoins size={14} /> Abonar
            </Boton>
          )}
          <AccionesFila nombre={`la deuda con ${deuda.persona}`} onEditar={onEditar} onEliminar={onEliminar} />
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-superficie-2">
        <div className="h-full rounded-full bg-acento-500 transition-all" style={{ width: `${porcentaje}%` }} />
      </div>

      {deuda.abonos.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta} className="flex items-center gap-1 text-xs font-medium text-tenue hover:text-texto">
            <ChevronDown size={14} className={`transition-transform ${abierta ? "rotate-180" : ""}`} />
            {deuda.abonos.length} {deuda.abonos.length === 1 ? "abono" : "abonos"} · {formatearDinero(deuda.abonado, deuda.moneda)}
          </button>
          {abierta && (
            <ul className="mt-1 space-y-1 pl-5 text-xs">
              {deuda.abonos.map((abono) => (
                <li key={abono.id} className="flex items-center gap-2">
                  <span className="text-tenue">{formatearFecha(abono.fecha)}</span>
                  <span className="font-medium tabular-nums">{formatearDinero(abono.monto, deuda.moneda)}</span>
                  <span className="min-w-0 flex-1 truncate text-tenue">
                    {abono.cuenta_id !== null && cuentaPorId.get(abono.cuenta_id)?.nombre}
                    {abono.notas && ` · ${abono.notas}`}
                  </span>
                  <button type="button" onClick={() => onEliminarAbono(abono.id)} aria-label="Eliminar abono" className="rounded p-1 text-tenue-2 hover:text-rose-600">
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
