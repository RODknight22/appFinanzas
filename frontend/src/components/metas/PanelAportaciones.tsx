import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { metasApi } from "../../api/recursos";
import { useDatos } from "../../hooks/useDatos";
import { confirmarYEliminar, useEnvio } from "../../hooks/useEnvio";
import type { Meta } from "../../types";
import { lanzarConfeti } from "../../utils/confeti";
import { formatearDinero, formatearFecha, hoyISO } from "../../utils/formato";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, Campo, ErrorFormulario } from "../ui/Campo";
import { Contenido } from "../ui/Estados";

interface PanelAportacionesProps {
  meta: Meta;
  /** Se llama tras aportar o borrar, para refrescar el progreso de la meta. */
  onCambio: () => void;
}

/** Formulario para aportar o retirar + historial de aportaciones de la meta. */
export function PanelAportaciones({ meta, onCambio }: PanelAportacionesProps) {
  const [sentido, setSentido] = useState<"aportar" | "retirar">("aportar");
  const [monto, setMonto] = useState(meta.ahorro_mensual ?? "");
  const [fecha, setFecha] = useState(hoyISO());
  const [notas, setNotas] = useState("");
  const { enviando, error, ejecutar } = useEnvio();
  const historial = useDatos(() => metasApi.aportaciones(meta.id), [meta.id]);

  function despuesDeCambiar() {
    historial.recargar();
    onCambio();
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    // Una retirada se guarda como importe negativo.
    const importe = sentido === "retirar" ? `-${monto}` : String(monto);
    const ok = await ejecutar(() => metasApi.aportar(meta.id, { monto: importe, fecha, notas: notas.trim() || null }));
    if (ok) {
      if (sentido === "aportar") {
        // Un pequeño chorro de confeti desde el botón: cada aportación cuenta.
        const boton = (evento.nativeEvent as SubmitEvent).submitter?.getBoundingClientRect();
        lanzarConfeti({
          x: boton ? (boton.left + boton.width / 2) / window.innerWidth : 0.5,
          y: boton ? boton.top / window.innerHeight : 0.5,
          cantidad: 45,
          dispersion: 60,
        });
      }
      setMonto("");
      setNotas("");
      despuesDeCambiar();
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={enviar} className="space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-superficie-2 p-1">
          {(["aportar", "retirar"] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setSentido(opcion)}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                sentido === opcion ? "bg-superficie shadow-sm" : "text-tenue"
              }`}
            >
              {opcion === "aportar" ? "Aportar" : "Retirar"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta={`Importe (${meta.moneda})`}>
            <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required autoFocus />
          </Campo>
          <Campo etiqueta="Fecha">
            <input className={CLASE_ENTRADA} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </Campo>
        </div>
        <Campo etiqueta="Notas (opcional)">
          <input className={CLASE_ENTRADA} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej.: lo que sobró de la quincena" />
        </Campo>
        <ErrorFormulario mensaje={error} />
        <div className="flex justify-end">
          <Boton type="submit" disabled={enviando}>{enviando ? "Guardando…" : sentido === "aportar" ? "Aportar" : "Retirar"}</Boton>
        </div>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-medium text-suave">Historial</h3>
        <Contenido {...historial} onReintentar={historial.recargar}>
          {(aportaciones) =>
            aportaciones.length === 0 ? (
              <p className="text-sm text-tenue">Aún no hay aportaciones.</p>
            ) : (
              <ul className="max-h-60 divide-y divide-linea overflow-y-auto text-sm">
                {aportaciones.map((a) => {
                  const negativa = Number(a.monto) < 0;
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-tenue">
                        {formatearFecha(a.fecha)}{a.notas && ` · ${a.notas}`}
                      </span>
                      <span className={`tabular-nums font-medium ${negativa ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {negativa ? "−" : "+"}{formatearDinero(Math.abs(Number(a.monto)), meta.moneda)}
                      </span>
                      <button
                        type="button"
                        aria-label="Eliminar aportación"
                        className="rounded-lg p-1 text-tenue-2 hover:bg-realce hover:text-rose-600"
                        onClick={() => confirmarYEliminar("¿Eliminar esta aportación?", () => metasApi.eliminarAportacion(meta.id, a.id), despuesDeCambiar)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          }
        </Contenido>
      </div>
    </div>
  );
}
