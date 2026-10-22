import { useState, type FormEvent } from "react";

import { deudasApi } from "../../api/recursos";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import type { Cuenta, Deuda, Moneda, SentidoDeuda } from "../../types";
import { hoyISO } from "../../utils/formato";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { SelectMoneda } from "../ui/SelectMoneda";
import { SelectorFecha } from "../ui/SelectorFecha";
import { PieFormulario } from "./PieFormulario";

interface FormularioDeudaProps {
  inicial?: Deuda;
  /** Sentido preseleccionado al crear (el de la pestaña abierta). */
  sentidoInicial: SentidoDeuda;
  cuentas: Cuenta[];
  onGuardado: () => void;
  onCancelar: () => void;
}

const SENTIDOS: Record<SentidoDeuda, { etiqueta: string; cuenta: string }> = {
  me_deben: { etiqueta: "Presté dinero", cuenta: "¿De qué cuenta salió?" },
  debo: { etiqueta: "Me prestaron", cuenta: "¿A qué cuenta llegó?" },
};

export function FormularioDeuda({ inicial, sentidoInicial, cuentas, onGuardado, onCancelar }: FormularioDeudaProps) {
  const { moneda: monedaPrincipal } = useConfiguracion();
  const [persona, setPersona] = useState(inicial?.persona ?? "");
  const [sentido, setSentido] = useState<SentidoDeuda>(inicial?.sentido ?? sentidoInicial);
  const [monto, setMonto] = useState(inicial?.monto ?? "");
  const [cuentaId, setCuentaId] = useState(String(inicial?.cuenta_id ?? ""));
  const [monedaLibre, setMonedaLibre] = useState<Moneda>(inicial?.moneda ?? monedaPrincipal);
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoyISO());
  const [vencimiento, setVencimiento] = useState(inicial?.fecha_vencimiento ?? "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const { enviando, error, ejecutar } = useEnvio();

  // Con cuenta, la deuda va en su moneda (el backend lo exige para no mezclar divisas).
  const cuenta = cuentas.find((c) => c.id === Number(cuentaId));
  const moneda = cuenta?.moneda ?? monedaLibre;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const datos = {
      persona: persona.trim(),
      sentido,
      monto,
      moneda,
      fecha,
      fecha_vencimiento: vencimiento || null,
      cuenta_id: cuenta ? cuenta.id : null,
      notas: notas.trim() || null,
    };
    const ok = await ejecutar(() => (inicial ? deudasApi.actualizar(inicial.id, datos) : deudasApi.crear(datos)));
    if (ok) onGuardado();
  }

  const claseSentido = (activo: boolean) =>
    `rounded-full py-2 text-sm font-semibold transition-colors ${activo ? "bg-superficie text-texto shadow-[var(--sombra)]" : "text-tenue hover:text-texto"}`;

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="grid grid-cols-2 rounded-full bg-superficie-2 p-1" role="group" aria-label="Tipo de deuda">
        {(Object.keys(SENTIDOS) as SentidoDeuda[]).map((valor) => (
          <button key={valor} type="button" onClick={() => setSentido(valor)} aria-pressed={sentido === valor} className={claseSentido(sentido === valor)}>
            {SENTIDOS[valor].etiqueta}
          </button>
        ))}
      </div>

      <Campo etiqueta={sentido === "me_deben" ? "¿A quién?" : "¿Quién?"}>
        <input className={CLASE_ENTRADA} value={persona} onChange={(e) => setPersona(e.target.value)} required maxLength={100} placeholder="Ej.: Ana, mi hermano" autoFocus />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-end gap-1.5">
          <div className="min-w-0 flex-1">
            <Campo etiqueta="Importe">
              <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
            </Campo>
          </div>
          {cuenta ? (
            <span className="pb-2 text-sm font-medium text-tenue">{moneda}</span>
          ) : (
            <SelectMoneda valor={monedaLibre} onCambiar={setMonedaLibre} compacta className="w-[5.5rem]" etiqueta="Moneda" />
          )}
        </div>
        <Campo etiqueta={SENTIDOS[sentido].cuenta}>
          <select className={CLASE_ENTRADA} value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">Ninguna (solo apuntarlo)</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SelectorFecha etiqueta="Fecha" valor={fecha} onCambiar={setFecha} />
        <SelectorFecha etiqueta="Vence (opcional)" valor={vencimiento} onCambiar={setVencimiento} opcional />
      </div>

      <Campo etiqueta="Notas (opcional)">
        <input className={CLASE_ENTRADA} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej.: la cena del sábado" />
      </Campo>

      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
