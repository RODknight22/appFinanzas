import { CheckCircle2, ChevronRight, Circle, PartyPopper, X } from "lucide-react";
import { Link } from "react-router";

import { useConfiguracion } from "../../hooks/useConfiguracion";
import { avisarError } from "../ajustes/avisarError";

export interface ProgresoPrimerosPasos {
  cuentas: number;
  transacciones: number;
  presupuestos: number;
  metas: number;
}

/** Primeros pasos del panel: se tachan solos al cumplirse y la tarjeta se puede cerrar. */
export function TarjetaBienvenida({ progreso }: { progreso: ProgresoPrimerosPasos }) {
  const { actualizarConfiguracion } = useConfiguracion();
  const pasos = [
    { hecho: progreso.cuentas > 0, texto: "Crea tu primera cuenta", ruta: "/cuentas" },
    { hecho: progreso.transacciones > 0, texto: "Anota un gasto o un ingreso (o importa un extracto)", ruta: "/transacciones" },
    { hecho: progreso.presupuestos > 0, texto: "Ponle un límite a una categoría este mes", ruta: "/presupuestos" },
    { hecho: progreso.metas > 0, texto: "Crea una meta de ahorro", ruta: "/metas" },
  ];
  const hechos = pasos.filter((p) => p.hecho).length;
  const completo = hechos === pasos.length;

  return (
    <section className="mb-6 animate-entrada rounded-3xl bg-superficie p-5 shadow-[var(--sombra)] ring-1 ring-linea">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            {completo && <PartyPopper size={18} className="text-acento-600 dark:text-acento-400" />}
            {completo ? "¡Todo listo! Ya dominas lo básico" : "Primeros pasos"}
          </h2>
          <p className="text-xs text-tenue">{hechos} de {pasos.length} completados</p>
        </div>
        <button
          type="button"
          onClick={() => actualizarConfiguracion({ bienvenida_cerrada: true }).catch(avisarError)}
          aria-label="Cerrar primeros pasos"
          title="Cerrar (puedes volver a verla desde Ajustes)"
          className="rounded-lg p-1 text-tenue-2 hover:bg-realce hover:text-texto"
        >
          <X size={18} />
        </button>
      </header>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-superficie-2">
        <div className="h-full rounded-full bg-acento-500 transition-all" style={{ width: `${(hechos / pasos.length) * 100}%` }} />
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {pasos.map(({ hecho, texto, ruta }) => (
          <li key={ruta}>
            <Link
              to={ruta}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-realce ${hecho ? "text-tenue line-through" : ""}`}
            >
              {hecho ? (
                <CheckCircle2 size={18} className="shrink-0 text-acento-600 dark:text-acento-400" />
              ) : (
                <Circle size={18} className="shrink-0 text-tenue-2" />
              )}
              <span className="flex-1">{texto}</span>
              {!hecho && <ChevronRight size={16} className="shrink-0 text-tenue-2" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
