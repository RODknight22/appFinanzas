import { ArrowDown } from "lucide-react";
import { useState, type FormEvent } from "react";

import { transferenciasApi } from "../../api/recursos";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import type { Cuenta, Moneda, Transferencia } from "../../types";
import { textoTipoDeCambio } from "../../utils/divisas";
import { formatearDinero, formatearNumero, hoyISO } from "../../utils/formato";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { PieFormulario } from "./PieFormulario";

/** Para abrir el formulario como "pagar tarjeta": destino y deuda ya rellenos. */
export interface PagoTarjeta {
  cuentaId: number;
  /** La deuda, en la moneda de la tarjeta. */
  monto: number;
}

interface FormularioTransferenciaProps {
  inicial?: Transferencia;
  pago?: PagoTarjeta;
  cuentas: Cuenta[];
  onGuardado: () => void;
  onCancelar: () => void;
}

/** "Tipo aplicado: 1 EUR = 21,43 MXN · un 1,5 % peor que el del mercado". */
function TipoDeCambioAplicado({ sale, llega, de, a }: { sale: number; llega: number; de: Moneda; a: Moneda }) {
  const { convertir } = useConfiguracion();
  if (!sale || !llega) return null;
  const aplicado = llega / sale;
  const mercado = convertir(1, de, a);
  // Positivo = te dieron menos de lo que marca la tasa de hoy (el coste oculto del cambio).
  const peor = mercado ? (1 - aplicado / mercado) * 100 : 0;
  return (
    <p className="text-xs text-slate-500">
      Tipo aplicado: {textoTipoDeCambio(aplicado, de, a)}
      {Math.abs(peor) >= 0.05 && (
        <span className={peor > 0 ? "text-amber-600 dark:text-amber-400" : ""}>
          {" "}· un {formatearNumero(Math.abs(peor), 1)} % {peor > 0 ? "peor" : "mejor"} que el del mercado hoy
        </span>
      )}
    </p>
  );
}

/** Al pagar una tarjeta, el origen por defecto es la primera cuenta que no sea de crédito. */
function origenPorDefecto(cuentas: Cuenta[], destinoId: number | undefined): number {
  const candidatas = cuentas.filter((c) => c.id !== destinoId);
  return (candidatas.find((c) => c.tipo !== "credito") ?? candidatas[0])?.id ?? 0;
}

export function FormularioTransferencia({ inicial, pago, cuentas, onGuardado, onCancelar }: FormularioTransferenciaProps) {
  const { convertir } = useConfiguracion();
  const cuentaDe = (id: number) => cuentas.find((c) => c.id === id);

  const [destinoId, setDestinoId] = useState(
    inicial?.cuenta_destino_id ?? pago?.cuentaId ?? cuentas.find((c) => c.id !== cuentas[0]?.id)?.id ?? 0,
  );
  const [origenId, setOrigenId] = useState(inicial?.cuenta_origen_id ?? origenPorDefecto(cuentas, destinoId));
  // Al pagar una tarjeta en otra moneda, lo que sale se estima a partir de la deuda.
  const [montoOrigen, setMontoOrigen] = useState(() => {
    if (inicial) return inicial.monto_origen;
    if (!pago) return "";
    const enOrigen = convertir(pago.monto, cuentaDe(pago.cuentaId)!.moneda, cuentaDe(origenId)?.moneda);
    return enOrigen === undefined ? "" : enOrigen.toFixed(2);
  });
  const [montoDestino, setMontoDestino] = useState(inicial?.monto_destino ?? (pago ? pago.monto.toFixed(2) : ""));
  const [comision, setComision] = useState(inicial?.comision ?? "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoyISO());
  const [notas, setNotas] = useState(inicial?.notas ?? (pago ? "Pago de tarjeta" : ""));
  const { enviando, error, ejecutar } = useEnvio();

  const origen = cuentaDe(origenId);
  const destino = cuentaDe(destinoId);
  const entreMonedas = Boolean(origen && destino && origen.moneda !== destino.moneda);
  const estimado = entreMonedas && montoOrigen ? convertir(Number(montoOrigen), origen!.moneda, destino!.moneda) : undefined;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const datos = {
      cuenta_origen_id: origenId,
      cuenta_destino_id: destinoId,
      monto_origen: montoOrigen,
      // Vacío = que el backend lo estime con la tasa de la fecha.
      monto_destino: entreMonedas && montoDestino ? montoDestino : null,
      comision: comision && Number(comision) > 0 ? comision : null,
      fecha,
      notas: notas.trim() || null,
    };
    const ok = await ejecutar(() =>
      inicial ? transferenciasApi.actualizar(inicial.id, datos) : transferenciasApi.crear(datos),
    );
    if (ok) onGuardado();
  }

  if (cuentas.length < 2) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">Necesitas al menos dos cuentas para hacer una transferencia.</p>;
  }

  const opciones = (excluir: number) =>
    cuentas
      .filter((c) => c.id !== excluir)
      .map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.moneda}</option>);

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="space-y-2">
        <Campo etiqueta="Desde">
          <select className={CLASE_ENTRADA} value={origenId} onChange={(e) => setOrigenId(Number(e.target.value))}>
            {opciones(destinoId)}
          </select>
        </Campo>
        <ArrowDown size={16} className="mx-auto text-slate-400" aria-hidden />
        <Campo etiqueta="Hacia">
          <select className={CLASE_ENTRADA} value={destinoId} onChange={(e) => setDestinoId(Number(e.target.value))}>
            {opciones(origenId)}
          </select>
        </Campo>
      </div>

      <div className="space-y-1.5">
        {/* El importe que llega solo se pide entre monedas distintas: si no, es el mismo */}
        <div className={`grid gap-3 ${entreMonedas ? "grid-cols-2" : ""}`}>
          <Campo etiqueta={`Sale (${origen?.moneda ?? ""})`}>
            <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={montoOrigen} onChange={(e) => setMontoOrigen(e.target.value)} required autoFocus />
          </Campo>
          {entreMonedas && (
            <Campo etiqueta={`Llega (${destino?.moneda ?? ""})`}>
              <input
                className={CLASE_ENTRADA}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={montoDestino}
                onChange={(e) => setMontoDestino(e.target.value)}
                placeholder={estimado === undefined ? "" : `≈ ${estimado.toFixed(2)}`}
              />
            </Campo>
          )}
        </div>
        {entreMonedas &&
          (montoDestino ? (
            <TipoDeCambioAplicado sale={Number(montoOrigen)} llega={Number(montoDestino)} de={origen!.moneda} a={destino!.moneda} />
          ) : (
            <p className="text-xs text-slate-500">
              Escribe lo que te llegó de verdad para guardar el tipo de cambio real. Si lo dejas vacío, se estima con la tasa de la fecha.
            </p>
          ))}
      </div>

      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha">
            <input className={CLASE_ENTRADA} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </Campo>
          <Campo etiqueta={`Comisión (${origen?.moneda ?? ""})`}>
            <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0" value={comision} onChange={(e) => setComision(e.target.value)} placeholder="Opcional" />
          </Campo>
        </div>
        <p className="text-xs text-slate-500">
          {Number(comision) > 0 && origen
            ? `La comisión se anota como gasto en "Comisiones": en total salen ${formatearDinero(Number(montoOrigen) + Number(comision), origen.moneda)}.`
            : "La transferencia no cuenta como ingreso ni gasto; la comisión del banco, sí."}
        </p>
      </div>

      <Campo etiqueta="Notas (opcional)">
        <input className={CLASE_ENTRADA} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej.: envío desde México" />
      </Campo>

      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} textoGuardar={inicial ? "Guardar" : "Transferir"} />
    </form>
  );
}
