import { useState, type FormEvent } from "react";

import { presupuestosApi } from "../../api/recursos";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, MesAnio, Moneda, Presupuesto } from "../../types";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { SelectMoneda } from "../ui/SelectMoneda";
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
  const { moneda: monedaPrincipal } = useConfiguracion();
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda ?? monedaPrincipal);
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const datos = { categoria_id: Number(categoriaId), monto_limite: montoLimite, mes_anio: mes, moneda };
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
      <div className="flex items-end gap-1.5">
        <div className="min-w-0 flex-1">
          <Campo etiqueta="Límite mensual">
            <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={montoLimite} onChange={(e) => setMontoLimite(e.target.value)} required />
          </Campo>
        </div>
        <SelectMoneda valor={moneda} onCambiar={setMoneda} compacta className="w-[5.5rem]" etiqueta="Moneda" />
      </div>
      <Campo etiqueta="Mes">
        <input className={CLASE_ENTRADA} type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
      </Campo>
      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
