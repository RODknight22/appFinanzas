import { useState, type FormEvent } from "react";

import { presupuestosApi } from "../../api/recursos";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, MesAnio, Presupuesto } from "../../types";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { PieFormulario } from "./PieFormulario";

interface FormularioPresupuestoProps {
  inicial?: Presupuesto;
  /** Solo categorías de gasto: no tiene sentido limitar un ingreso. */
  categoriasGasto: Categoria[];
  mesInicial: MesAnio;
  onGuardado: () => void;
  onCancelar: () => void;
}

export function FormularioPresupuesto({ inicial, categoriasGasto, mesInicial, onGuardado, onCancelar }: FormularioPresupuestoProps) {
  const [categoriaId, setCategoriaId] = useState(inicial ? String(inicial.categoria_id) : "");
  const [montoLimite, setMontoLimite] = useState(inicial?.monto_limite ?? "");
  const [mes, setMes] = useState(inicial?.mes_anio ?? mesInicial);
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const datos = { categoria_id: Number(categoriaId), monto_limite: montoLimite, mes_anio: mes };
    const ok = await ejecutar(() =>
      inicial ? presupuestosApi.actualizar(inicial.id, datos) : presupuestosApi.crear(datos),
    );
    if (ok) onGuardado();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Categoría de gasto">
        <select className={CLASE_ENTRADA} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
          <option value="" disabled>Elige una categoría…</option>
          {categoriasGasto.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Límite mensual">
        <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={montoLimite} onChange={(e) => setMontoLimite(e.target.value)} required />
      </Campo>
      <Campo etiqueta="Mes">
        <input className={CLASE_ENTRADA} type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
      </Campo>
      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
