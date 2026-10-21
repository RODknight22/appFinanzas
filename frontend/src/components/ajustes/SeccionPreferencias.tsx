import { GraduationCap } from "lucide-react";

import { PAGINAS_INICIO } from "../../config";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import type { PaginaInicio } from "../../types";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { Tarjeta } from "../ui/Tarjeta";
import { avisarError } from "./avisarError";

// 1-28: así el día existe en todos los meses, febrero incluido.
const DIAS = Array.from({ length: 28 }, (_, i) => i + 1);

/** Página que se abre al entrar, día en que empieza el mes financiero y ayudas. */
export function SeccionPreferencias() {
  const { configuracion, actualizarConfiguracion } = useConfiguracion();

  return (
    <Tarjeta titulo="Preferencias">
      <div className="space-y-4">
        <Campo etiqueta="Página de inicio" ayuda="La que se abre al entrar en la app.">
          <select
            className={CLASE_ENTRADA}
            value={configuracion.pagina_inicio}
            onChange={(e) => actualizarConfiguracion({ pagina_inicio: e.target.value as PaginaInicio }).catch(avisarError)}
          >
            {Object.entries(PAGINAS_INICIO).map(([valor, { nombre }]) => (
              <option key={valor} value={valor}>{nombre}</option>
            ))}
          </select>
        </Campo>

        <Campo
          etiqueta="El mes empieza el día"
          ayuda="Útil si cobras a mitad de mes: con 15, tu «octubre» va del 15 de octubre al 14 de noviembre. Afecta al dashboard, presupuestos y transacciones."
        >
          <select
            className={CLASE_ENTRADA}
            value={configuracion.dia_inicio_mes}
            onChange={(e) => actualizarConfiguracion({ dia_inicio_mes: Number(e.target.value) }).catch(avisarError)}
          >
            {DIAS.map((dia) => (
              <option key={dia} value={dia}>{dia === 1 ? "1 (mes natural)" : dia}</option>
            ))}
          </select>
        </Campo>

        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm font-medium text-suave">
            <input
              type="checkbox"
              checked={configuracion.mostrar_consejos}
              onChange={(e) => actualizarConfiguracion({ mostrar_consejos: e.target.checked }).catch(avisarError)}
              className="accent-acento-600"
            />
            Mostrar consejos
          </label>
          <p className="text-xs text-tenue">Las bombillas con ayuda junto a los títulos y algunos botones.</p>
        </div>

        <Boton
          variante="secundario"
          onClick={() => actualizarConfiguracion({ tutorial_visto: false, bienvenida_cerrada: false }).catch(avisarError)}
        >
          <GraduationCap size={16} /> Ver el tutorial otra vez
        </Boton>
      </div>
    </Tarjeta>
  );
}
