import { useState, type FormEvent } from "react";

import { deudasApi } from "../../api/recursos";
import { useEnvio } from "../../hooks/useEnvio";
import type { Cuenta, Deuda } from "../../types";
import { formatearDinero, hoyISO } from "../../utils/formato";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { SelectorFecha } from "../ui/SelectorFecha";
import { PieFormulario } from "./PieFormulario";

interface FormularioAbonoProps {
  deuda: Deuda;
  cuentas: Cuenta[];
  onGuardado: () => void;
  onCancelar: () => void;
}

/** Anota una devolución. Viene relleno con todo lo pendiente y la cuenta del préstamo. */
export function FormularioAbono({ deuda, cuentas, onGuardado, onCancelar }: FormularioAbonoProps) {
  const [monto, setMonto] = useState(deuda.pendiente);
  const [fecha, setFecha] = useState(hoyISO());
  const [cuentaId, setCuentaId] = useState(String(deuda.cuenta_id ?? ""));
  const [notas, setNotas] = useState("");
  const { enviando, error, ejecutar } = useEnvio();
  // Solo cuentas en la moneda de la deuda: así ningún saldo mezcla divisas.
  const cuentasValidas = cuentas.filter((c) => c.moneda === deuda.moneda);
  const meDeben = deuda.sentido === "me_deben";

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const ok = await ejecutar(() =>
      deudasApi.abonar(deuda.id, { monto, fecha, cuenta_id: cuentaId ? Number(cuentaId) : null, notas: notas.trim() || null }),
    );
    if (ok) onGuardado();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <p className="rounded-lg bg-superficie-2 p-3 text-sm">
        {meDeben ? `${deuda.persona} te devuelve` : `Le pagas a ${deuda.persona}`}. Quedan{" "}
        <strong className="tabular-nums">{formatearDinero(deuda.pendiente, deuda.moneda)}</strong>.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta={`Importe (${deuda.moneda})`}>
          <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" max={deuda.pendiente} value={monto} onChange={(e) => setMonto(e.target.value)} required autoFocus />
        </Campo>
        <SelectorFecha etiqueta="Fecha" valor={fecha} onCambiar={setFecha} />
      </div>
      <Campo etiqueta={meDeben ? "¿A qué cuenta llegó?" : "¿De qué cuenta salió?"}>
        <select className={CLASE_ENTRADA} value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
          <option value="">Ninguna (solo apuntarlo)</option>
          {cuentasValidas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Notas (opcional)">
        <input className={CLASE_ENTRADA} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej.: por Bizum" />
      </Campo>
      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
