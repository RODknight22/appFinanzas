import { useState, type FormEvent } from "react";

import { suscripcionesApi } from "../../api/recursos";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, Cuenta, Moneda, Suscripcion } from "../../types";
import { hoyISO } from "../../utils/formato";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { SelectMoneda } from "../ui/SelectMoneda";
import { SelectorFecha } from "../ui/SelectorFecha";
import { CamposCalendario, SelectPeriodicidad, calendarioInicial, datosCalendario, errorCalendario } from "./CamposCalendario";
import { PieFormulario } from "./PieFormulario";

interface FormularioSuscripcionProps {
  inicial?: Suscripcion;
  cuentas: Cuenta[];
  categoriasGasto: Categoria[];
  onGuardado: () => void;
  onCancelar: () => void;
}

/** Un pago fijo: el mismo calendario que los ingresos y, si se quiere, su cuenta y categoría. */
export function FormularioSuscripcion({ inicial, cuentas, categoriasGasto, onGuardado, onCancelar }: FormularioSuscripcionProps) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [monto, setMonto] = useState(inicial?.monto ?? "");
  const { moneda: monedaPrincipal } = useConfiguracion();
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda ?? monedaPrincipal);
  const [fecha, setFecha] = useState(inicial?.fecha_proximo_pago ?? hoyISO());
  const [calendario, setCalendario] = useState(() => calendarioInicial(inicial));
  // "" = se elige al pagar. Van juntas: si se elige una, la otra pasa a ser obligatoria.
  const [cuentaId, setCuentaId] = useState(inicial?.cuenta_id ? String(inicial.cuenta_id) : "");
  const [categoriaId, setCategoriaId] = useState(inicial?.categoria_id ? String(inicial.categoria_id) : "");
  const algunaElegida = cuentaId !== "" || categoriaId !== "";
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (errorCalendario(calendario, "pago")) return; // el aviso ya se ve junto al calendario
    const datos = {
      nombre: nombre.trim(),
      monto,
      moneda,
      fecha_proximo_pago: fecha,
      cuenta_id: cuentaId ? Number(cuentaId) : null,
      categoria_id: categoriaId ? Number(categoriaId) : null,
      ...datosCalendario(calendario),
    };
    const ok = await ejecutar(() =>
      inicial ? suscripcionesApi.actualizar(inicial.id, datos) : suscripcionesApi.crear(datos),
    );
    if (ok) onGuardado();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Nombre">
        <input className={CLASE_ENTRADA} value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={100} placeholder="Ej.: Netflix, gimnasio, alquiler" autoFocus />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-end gap-1.5">
          <div className="min-w-0 flex-1">
            <Campo etiqueta="Monto">
              <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
            </Campo>
          </div>
          <SelectMoneda valor={moneda} onCambiar={setMoneda} compacta className="w-[5.5rem]" etiqueta="Moneda" />
        </div>
        <SelectPeriodicidad valor={calendario.periodicidad} onCambiar={(periodicidad) => setCalendario({ ...calendario, periodicidad })} />
      </div>
      <SelectorFecha etiqueta="Próximo cobro" valor={fecha} onCambiar={setFecha} />
      <CamposCalendario valor={calendario} onCambiar={(cambios) => setCalendario({ ...calendario, ...cambios })} cobro="pago" />

      <div className="space-y-1">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Cuenta de cargo">
            <select className={CLASE_ENTRADA} value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} required={algunaElegida}>
              <option value="">Elegir al pagar</option>
              {cuentas.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Categoría">
            <select className={CLASE_ENTRADA} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required={algunaElegida}>
              <option value="">Elegir al pagar</option>
              {categoriasGasto.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
              ))}
            </select>
          </Campo>
        </div>
        <p className="text-xs text-tenue">Con las dos elegidas, registrar el pago es un clic.</p>
      </div>
      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
