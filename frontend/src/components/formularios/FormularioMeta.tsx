import { useState, type FormEvent } from "react";

import { metasApi } from "../../api/recursos";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import type { Cuenta, Meta, Moneda } from "../../types";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { SelectMoneda } from "../ui/SelectMoneda";
import { PieFormulario } from "./PieFormulario";

const ICONOS_META = ["🎯", "✈️", "🏠", "🚗", "💻", "📱", "🎓", "💍", "🏖️", "🐶", "🎁", "🛟", "💰", "🇲🇽"];

interface FormularioMetaProps {
  inicial?: Meta;
  cuentas: Cuenta[];
  onGuardado: () => void;
  onCancelar: () => void;
}

export function FormularioMeta({ inicial, cuentas, onGuardado, onCancelar }: FormularioMetaProps) {
  const { moneda: principal } = useConfiguracion();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [icono, setIcono] = useState(inicial?.icono ?? "🎯");
  const [objetivo, setObjetivo] = useState(inicial?.monto_objetivo ?? "");
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda ?? principal);
  const [fechaLimite, setFechaLimite] = useState(inicial?.fecha_limite ?? "");
  // "" = se mide con aportaciones; un id = sigue el saldo de esa cuenta.
  const [cuentaId, setCuentaId] = useState(inicial?.cuenta_id ? String(inicial.cuenta_id) : "");
  const [modo, setModo] = useState<"aportaciones" | "cuenta">(inicial?.cuenta_id ? "cuenta" : "aportaciones");
  const { enviando, error, ejecutar } = useEnvio();

  function elegirCuenta(id: string) {
    setCuentaId(id);
    // Lo natural es medir la meta en la moneda de su cuenta (se puede cambiar después).
    const cuenta = cuentas.find((c) => String(c.id) === id);
    if (cuenta) setMoneda(cuenta.moneda);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const datos = {
      nombre: nombre.trim(),
      icono,
      monto_objetivo: objetivo,
      moneda,
      fecha_limite: fechaLimite || null,
      cuenta_id: modo === "cuenta" && cuentaId ? Number(cuentaId) : null,
    };
    const ok = await ejecutar(() => (inicial ? metasApi.actualizar(inicial.id, datos) : metasApi.crear(datos)));
    if (ok) onGuardado();
  }

  const claseOpcion = (activa: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded-full text-lg transition ${
      activa ? "bg-acento-100 ring-2 ring-acento-500 dark:bg-acento-950" : "hover:bg-slate-100 dark:hover:bg-slate-800"
    }`;
  const claseModo = (activo: boolean) =>
    `rounded-lg border px-3 py-2 text-left text-sm transition ${
      activo
        ? "border-acento-500 bg-acento-50 dark:bg-acento-950/50"
        : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
    }`;

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Nombre">
        <input className={CLASE_ENTRADA} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} required autoFocus placeholder="Ej.: Viaje a México" />
      </Campo>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Icono</legend>
        <div className="flex flex-wrap gap-1">
          {ICONOS_META.map((emoji) => (
            <button key={emoji} type="button" onClick={() => setIcono(emoji)} aria-pressed={icono === emoji} aria-label={`Icono ${emoji}`} className={claseOpcion(icono === emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-end gap-1.5">
          <div className="min-w-0 flex-1">
            <Campo etiqueta="Objetivo">
              <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} required />
            </Campo>
          </div>
          <SelectMoneda valor={moneda} onCambiar={setMoneda} compacta className="w-[5.5rem]" etiqueta="Moneda" />
        </div>
        <Campo etiqueta="Fecha límite (opcional)">
          <input className={CLASE_ENTRADA} type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
        </Campo>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">¿Cómo se mide el progreso?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" className={claseModo(modo === "aportaciones")} onClick={() => setModo("aportaciones")} aria-pressed={modo === "aportaciones"}>
            <span className="block font-medium">Con aportaciones</span>
            <span className="text-xs text-slate-500">Vas anotando lo que apartas. Varias metas pueden compartir cuenta.</span>
          </button>
          <button type="button" className={claseModo(modo === "cuenta")} onClick={() => setModo("cuenta")} aria-pressed={modo === "cuenta"} disabled={cuentas.length === 0}>
            <span className="block font-medium">Saldo de una cuenta</span>
            <span className="text-xs text-slate-500">Para una hucha o cajita dedicada: el progreso es su saldo.</span>
          </button>
        </div>
        {modo === "cuenta" && (
          <Campo etiqueta="Cuenta">
            <select className={CLASE_ENTRADA} value={cuentaId} onChange={(e) => elegirCuenta(e.target.value)} required>
              <option value="" disabled>Elige una cuenta…</option>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.moneda}</option>)}
            </select>
          </Campo>
        )}
      </fieldset>

      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
