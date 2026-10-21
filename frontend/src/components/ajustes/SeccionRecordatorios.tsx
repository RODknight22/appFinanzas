import { useState } from "react";

import { useConfiguracion } from "../../hooks/useConfiguracion";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { Tarjeta } from "../ui/Tarjeta";
import { avisarError } from "./avisarError";

const HORAS = Array.from({ length: 24 }, (_, hora) => hora);

/** Recordatorio diario de anotar gastos (en la campana; el correo, más adelante). */
export function SeccionRecordatorios() {
  const { configuracion, actualizarConfiguracion } = useConfiguracion();
  const [correo, setCorreo] = useState(configuracion.correo_recordatorios ?? "");

  function guardarCorreo() {
    if (correo.trim() === (configuracion.correo_recordatorios ?? "")) return;
    actualizarConfiguracion({ correo_recordatorios: correo.trim() }).catch(avisarError);
  }

  return (
    <Tarjeta titulo="Recordatorios">
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm font-medium text-suave">
            <input
              type="checkbox"
              checked={configuracion.recordatorio_diario}
              onChange={(e) => actualizarConfiguracion({ recordatorio_diario: e.target.checked }).catch(avisarError)}
              className="accent-acento-600"
            />
            Recordarme anotar los gastos cada día
          </label>
          <p className="text-xs text-tenue">Un aviso en la campana si a esa hora aún no has anotado nada ese día.</p>
        </div>

        {configuracion.recordatorio_diario && (
          <>
            <Campo etiqueta="A partir de las">
              <select
                className={CLASE_ENTRADA}
                value={configuracion.hora_recordatorio}
                onChange={(e) => actualizarConfiguracion({ hora_recordatorio: Number(e.target.value) }).catch(avisarError)}
              >
                {HORAS.map((hora) => (
                  <option key={hora} value={hora}>{`${String(hora).padStart(2, "0")}:00`}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Correo (opcional)" ayuda="Próximamente: el recordatorio también te llegará por correo.">
              <input className={CLASE_ENTRADA} type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} onBlur={guardarCorreo} maxLength={254} placeholder="tu@correo.com" />
            </Campo>
          </>
        )}
      </div>
    </Tarjeta>
  );
}
