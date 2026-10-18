import { useState, type FormEvent } from "react";

import { suscripcionesApi } from "../../api/recursos";
import { useEnvio } from "../../hooks/useEnvio";
import type { Periodicidad, Suscripcion } from "../../types";
import { hoyISO } from "../../utils/formato";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { PieFormulario } from "./PieFormulario";

export const PERIODICIDADES: Record<Periodicidad, string> = {
  semanal: "Semanal",
  mensual: "Mensual",
  anual: "Anual",
};

interface FormularioSuscripcionProps {
  inicial?: Suscripcion;
  onGuardado: () => void;
  onCancelar: () => void;
}

export function FormularioSuscripcion({ inicial, onGuardado, onCancelar }: FormularioSuscripcionProps) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [monto, setMonto] = useState(inicial?.monto ?? "");
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(inicial?.periodicidad ?? "mensual");
  const [fecha, setFecha] = useState(inicial?.fecha_proximo_pago ?? hoyISO());
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const datos = { nombre: nombre.trim(), monto, periodicidad, fecha_proximo_pago: fecha };
    const ok = await ejecutar(() =>
      inicial ? suscripcionesApi.actualizar(inicial.id, datos) : suscripcionesApi.crear(datos),
    );
    if (ok) onGuardado();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Nombre">
        <input className={CLASE_ENTRADA} value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={100} placeholder="Ej.: Netflix, gimnasio, alquiler" autoFocus />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Monto">
          <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Periodicidad">
          <select className={CLASE_ENTRADA} value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value as Periodicidad)}>
            {Object.entries(PERIODICIDADES).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Próximo cobro">
        <input className={CLASE_ENTRADA} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </Campo>
      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
