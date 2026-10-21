import { useState, type FormEvent } from "react";

import { suscripcionesApi } from "../../api/recursos";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import { PERIODICIDADES } from "../../config";
import type { Moneda, Periodicidad, Suscripcion } from "../../types";
import { hoyISO } from "../../utils/formato";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { SelectMoneda } from "../ui/SelectMoneda";
import { PieFormulario } from "./PieFormulario";

interface FormularioSuscripcionProps {
  inicial?: Suscripcion;
  onGuardado: () => void;
  onCancelar: () => void;
}

export function FormularioSuscripcion({ inicial, onGuardado, onCancelar }: FormularioSuscripcionProps) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [monto, setMonto] = useState(inicial?.monto ?? "");
  const { moneda: monedaPrincipal } = useConfiguracion();
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda ?? monedaPrincipal);
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(inicial?.periodicidad ?? "mensual");
  const [fecha, setFecha] = useState(inicial?.fecha_proximo_pago ?? hoyISO());
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const datos = { nombre: nombre.trim(), monto, moneda, periodicidad, fecha_proximo_pago: fecha };
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
        <div className="flex items-end gap-1.5">
          <div className="min-w-0 flex-1">
            <Campo etiqueta="Monto">
              <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
            </Campo>
          </div>
          <SelectMoneda valor={moneda} onCambiar={setMoneda} compacta className="w-[5.5rem]" etiqueta="Moneda" />
        </div>
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
