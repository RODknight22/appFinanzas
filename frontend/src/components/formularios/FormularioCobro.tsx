import { useState, type FormEvent } from "react";

import { ingresosApi } from "../../api/recursos";
import { useEnvio } from "../../hooks/useEnvio";
import type { Cuenta, IngresoRecurrente } from "../../types";
import { formatearFecha } from "../../utils/formato";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { SelectorFecha } from "../ui/SelectorFecha";
import { PieFormulario } from "./PieFormulario";

interface FormularioCobroProps {
  ingreso: IngresoRecurrente;
  cuentas: Cuenta[];
  onGuardado: () => void;
  onCancelar: () => void;
}

/**
 * Confirma que llegó el ingreso: crea la transacción y pasa al siguiente periodo.
 * Viene relleno con lo habitual; se cambia solo si ese cobro fue distinto.
 */
export function FormularioCobro({ ingreso, cuentas, onGuardado, onCancelar }: FormularioCobroProps) {
  const [monto, setMonto] = useState(ingreso.monto);
  const [fecha, setFecha] = useState(ingreso.fecha_proximo_cobro);
  const [cuentaId, setCuentaId] = useState(String(ingreso.cuenta_id));
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const ok = await ejecutar(() =>
      ingresosApi.registrarCobro(ingreso.id, { monto, fecha, cuenta_id: Number(cuentaId) }),
    );
    if (ok) onGuardado();
  }

  async function omitir() {
    const ok = await ejecutar(() => ingresosApi.omitir(ingreso.id));
    if (ok) onGuardado();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <p className="rounded-lg bg-superficie-2 p-3 text-sm">
        Se anotará como ingreso y el próximo cobro de <strong>{ingreso.nombre}</strong> pasará al siguiente
        periodo (desde el {formatearFecha(ingreso.fecha_proximo_cobro)}).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta={`Monto recibido (${ingreso.moneda})`}>
          <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required autoFocus />
        </Campo>
        <SelectorFecha etiqueta="Fecha" valor={fecha} onCambiar={setFecha} />
      </div>
      <Campo etiqueta="Cuenta">
        <select className={CLASE_ENTRADA} value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} required>
          {cuentas.map((cuenta) => (
            <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
          ))}
        </select>
      </Campo>
      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} textoGuardar="Registrar cobro" />
      <p className="text-center text-xs text-tenue">
        ¿No llegó este periodo?{" "}
        <Boton variante="fantasma" className="px-2 py-1 text-xs" onClick={omitir} disabled={enviando}>
          Omitir sin anotar nada
        </Boton>
      </p>
    </form>
  );
}
