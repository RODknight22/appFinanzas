import { Hourglass } from "lucide-react";
import { useState, type FormEvent } from "react";

import { deseosApi } from "../../api/recursos";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import type { Deseo, Meta, Moneda, PrioridadDeseo } from "../../types";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { SelectMoneda } from "../ui/SelectMoneda";
import { PieFormulario } from "./PieFormulario";

interface FormularioDeseoProps {
  inicial?: Deseo;
  metas: Meta[];
  onGuardado: () => void;
  onCancelar: () => void;
}

export const PRIORIDADES: Record<PrioridadDeseo, string> = { alta: "Alta", media: "Media", baja: "Baja" };

/** Plazos de la máquina del tiempo (0 = añadirlo directamente a la lista). */
const ESPERAS = [
  { dias: 0, etiqueta: "Sin esperar" },
  { dias: 1, etiqueta: "24 horas" },
  { dias: 7, etiqueta: "1 semana" },
  { dias: 30, etiqueta: "1 mes" },
];

export function FormularioDeseo({ inicial, metas, onGuardado, onCancelar }: FormularioDeseoProps) {
  const { moneda: monedaPrincipal } = useConfiguracion();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [precio, setPrecio] = useState(inicial?.precio ?? "");
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda ?? monedaPrincipal);
  const [enlace, setEnlace] = useState(inicial?.enlace ?? "");
  const [prioridad, setPrioridad] = useState<PrioridadDeseo>(inicial?.prioridad ?? "media");
  const [metaId, setMetaId] = useState(String(inicial?.meta_id ?? ""));
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  // Por defecto, una semana de reflexión: la idea es frenar el impulso.
  const [dias, setDias] = useState(7);
  const [carta, setCarta] = useState(inicial?.carta ?? "");
  const { enviando, error, ejecutar } = useEnvio();
  const mostrarCarta = inicial ? inicial.estado === "en_reflexion" || Boolean(inicial.carta) : dias > 0;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const datos = {
      nombre: nombre.trim(),
      precio,
      moneda,
      enlace: enlace.trim() || null,
      prioridad,
      meta_id: metaId ? Number(metaId) : null,
      notas: notas.trim() || null,
      carta: mostrarCarta ? carta.trim() || null : null,
    };
    const ok = await ejecutar(() =>
      inicial ? deseosApi.actualizar(inicial.id, datos) : deseosApi.crear({ ...datos, dias_reflexion: dias || null }),
    );
    if (ok) onGuardado();
  }

  const claseOpcion = (activa: boolean) =>
    `rounded-xl border px-2 py-2 text-xs font-medium transition ${
      activa ? "border-acento-500 bg-acento-50 text-acento-700 dark:bg-acento-950/50 dark:text-acento-300" : "border-linea text-suave hover:bg-realce"
    }`;

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="¿Qué quieres?">
        <input className={CLASE_ENTRADA} value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={100} placeholder="Ej.: Zapatillas de running" autoFocus />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-end gap-1.5">
          <div className="min-w-0 flex-1">
            <Campo etiqueta="Precio">
              <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} required />
            </Campo>
          </div>
          <SelectMoneda valor={moneda} onCambiar={setMoneda} compacta className="w-[5.5rem]" etiqueta="Moneda" />
        </div>
        <Campo etiqueta="Prioridad">
          <select className={CLASE_ENTRADA} value={prioridad} onChange={(e) => setPrioridad(e.target.value as PrioridadDeseo)}>
            {Object.entries(PRIORIDADES).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo etiqueta="Enlace (opcional)" ayuda="De Amazon, SHEIN o cualquier tienda: lo tendrás a un clic.">
        <input className={CLASE_ENTRADA} type="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} maxLength={500} placeholder="https://…" />
      </Campo>

      {metas.length > 0 && (
        <Campo etiqueta="Meta de ahorro (opcional)" ayuda="O créala después desde la lista con «Ahorrar para esto».">
          <select className={CLASE_ENTRADA} value={metaId} onChange={(e) => setMetaId(e.target.value)}>
            <option value="">Ninguna</option>
            {metas.map((meta) => (
              <option key={meta.id} value={meta.id}>{meta.icono} {meta.nombre}</option>
            ))}
          </select>
        </Campo>
      )}

      {!inicial && (
        <fieldset className="space-y-2 rounded-xl bg-superficie-2/60 p-3">
          <legend className="flex items-center gap-1.5 text-sm font-medium text-suave">
            <Hourglass size={15} /> Máquina del tiempo
          </legend>
          <p className="text-xs text-tenue">Espera antes de comprarlo: si sigues queriéndolo después, adelante.</p>
          <div className="grid grid-cols-4 gap-1.5">
            {ESPERAS.map((espera) => (
              <button key={espera.dias} type="button" onClick={() => setDias(espera.dias)} aria-pressed={dias === espera.dias} className={claseOpcion(dias === espera.dias)}>
                {espera.etiqueta}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {mostrarCarta && (
        <Campo etiqueta="Carta a tu yo del futuro" ayuda="La leerás al acabar la espera, con la cabeza fría.">
          <textarea className={`${CLASE_ENTRADA} min-h-20`} value={carta} onChange={(e) => setCarta(e.target.value)} maxLength={1000} placeholder="¿Por qué lo quieres? ¿Qué esperas que cambie al tenerlo?" />
        </Campo>
      )}

      <Campo etiqueta="Notas (opcional)">
        <input className={CLASE_ENTRADA} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej.: talla 42, color negro" />
      </Campo>

      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
