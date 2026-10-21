import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { ingresosApi } from "../../api/recursos";
import { PERIODICIDADES } from "../../config";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, Cuenta, IngresoRecurrente, Moneda, Periodicidad } from "../../types";
import { hoyISO } from "../../utils/formato";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { SelectMoneda } from "../ui/SelectMoneda";
import { PieFormulario } from "./PieFormulario";

interface FormularioIngresoProps {
  inicial?: IngresoRecurrente;
  cuentas: Cuenta[];
  categoriasIngreso: Categoria[];
  onGuardado: () => void;
  onCancelar: () => void;
}

export function FormularioIngreso({ inicial, cuentas, categoriasIngreso, onGuardado, onCancelar }: FormularioIngresoProps) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [monto, setMonto] = useState(inicial?.monto ?? "");
  const [cuentaId, setCuentaId] = useState(String(inicial?.cuenta_id ?? cuentas[0]?.id ?? ""));
  // null = "la de la cuenta": cambia sola al elegir otra cuenta hasta que se toque.
  const [moneda, setMoneda] = useState<Moneda | null>(inicial?.moneda ?? null);
  const { moneda: monedaPrincipal } = useConfiguracion();
  const monedaFinal = moneda ?? cuentas.find((c) => c.id === Number(cuentaId))?.moneda ?? monedaPrincipal;
  const [categoriaId, setCategoriaId] = useState(String(inicial?.categoria_id ?? ""));
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(inicial?.periodicidad ?? "mensual");
  const [fecha, setFecha] = useState(inicial?.fecha_proximo_cobro ?? hoyISO());
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const datos = {
      nombre: nombre.trim(),
      monto,
      moneda: monedaFinal,
      periodicidad,
      fecha_proximo_cobro: fecha,
      cuenta_id: Number(cuentaId),
      categoria_id: Number(categoriaId),
    };
    const ok = await ejecutar(() => (inicial ? ingresosApi.actualizar(inicial.id, datos) : ingresosApi.crear(datos)));
    if (ok) onGuardado();
  }

  if (cuentas.length === 0 || categoriasIngreso.length === 0) {
    return (
      <p className="text-sm text-suave">
        Necesitas al menos una <Link to="/cuentas" className="font-medium text-acento-600 hover:underline">cuenta</Link> y una{" "}
        <Link to="/categorias" className="font-medium text-acento-600 hover:underline">categoría de ingreso</Link>.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Nombre">
        <input className={CLASE_ENTRADA} value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={100} placeholder="Ej.: Nómina, renta del depa, envío de casa" autoFocus />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-end gap-1.5">
          <div className="min-w-0 flex-1">
            <Campo etiqueta="Monto habitual">
              <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
            </Campo>
          </div>
          <SelectMoneda valor={monedaFinal} onCambiar={setMoneda} compacta className="w-[5.5rem]" etiqueta="Moneda" />
        </div>
        <Campo etiqueta="Periodicidad" ayuda={periodicidad === "quincenal" ? "Los días 15 y último de cada mes" : undefined}>
          <select className={CLASE_ENTRADA} value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value as Periodicidad)}>
            {Object.entries(PERIODICIDADES).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Cuenta donde llega">
          <select className={CLASE_ENTRADA} value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} required>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Categoría">
          <select className={CLASE_ENTRADA} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
            <option value="" disabled>Elige…</option>
            {categoriasIngreso.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
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
