import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { ingresosApi } from "../../api/recursos";
import { PERIODICIDADES } from "../../config";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, Cuenta, IngresoRecurrente, Moneda, Periodicidad } from "../../types";
import { hoyISO } from "../../utils/formato";
import { UNIDADES, ULTIMO_DIA, textoDia } from "../../utils/periodicidad";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { SelectMoneda } from "../ui/SelectMoneda";
import { SelectorFecha } from "../ui/SelectorFecha";
import { PieFormulario } from "./PieFormulario";

/** Días 1-30 y "Último día" (31), que el backend recorta según el mes. */
function OpcionesDia() {
  return (
    <>
      {Array.from({ length: ULTIMO_DIA }, (_, i) => i + 1).map((dia) => (
        <option key={dia} value={dia}>{dia === ULTIMO_DIA ? "Último día" : `Día ${textoDia(dia)}`}</option>
      ))}
    </>
  );
}

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
  const [intervalo, setIntervalo] = useState(String(inicial?.intervalo ?? 1));
  const [diaQuincena1, setDiaQuincena1] = useState(inicial?.dia_quincena_1 ?? 15);
  const [diaQuincena2, setDiaQuincena2] = useState(inicial?.dia_quincena_2 ?? ULTIMO_DIA);
  // "" = el día de la fecha del próximo cobro (comportamiento clásico).
  const [diaDelMes, setDiaDelMes] = useState(inicial?.dia_del_mes ? String(inicial.dia_del_mes) : "");
  const [adelantar, setAdelantar] = useState(inicial?.adelantar_a_habil ?? false);
  const quincenal = periodicidad === "quincenal";
  const mensual = periodicidad === "mensual";
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
      // Solo se guarda lo que aplica a la periodicidad elegida; el resto, null.
      intervalo: quincenal || Number(intervalo) <= 1 ? null : Number(intervalo),
      dia_quincena_1: quincenal ? diaQuincena1 : null,
      dia_quincena_2: quincenal ? diaQuincena2 : null,
      dia_del_mes: mensual && diaDelMes ? Number(diaDelMes) : null,
      adelantar_a_habil: quincenal || mensual ? adelantar : null,
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
        <Campo etiqueta="Periodicidad">
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
      <SelectorFecha etiqueta="Próximo cobro" valor={fecha} onCambiar={setFecha} />

      <fieldset className="space-y-3 rounded-xl bg-superficie-2/60 p-3">
        <legend className="sr-only">Calendario de cobro</legend>
        {quincenal ? (
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Primer cobro">
              <select className={CLASE_ENTRADA} value={diaQuincena1} onChange={(e) => setDiaQuincena1(Number(e.target.value))}>
                <OpcionesDia />
              </select>
            </Campo>
            <Campo etiqueta="Segundo cobro">
              <select className={CLASE_ENTRADA} value={diaQuincena2} onChange={(e) => setDiaQuincena2(Number(e.target.value))}>
                <OpcionesDia />
              </select>
            </Campo>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Repetir cada">
              <div className="flex items-center gap-2">
                <input className={CLASE_ENTRADA} type="number" inputMode="numeric" min="1" max="365" step="1" value={intervalo} onChange={(e) => setIntervalo(e.target.value)} required />
                <span className="shrink-0 text-sm text-tenue">{UNIDADES[periodicidad][Number(intervalo) === 1 ? 0 : 1]}</span>
              </div>
            </Campo>
            {mensual && (
              <Campo etiqueta="Día del cobro">
                <select className={CLASE_ENTRADA} value={diaDelMes} onChange={(e) => setDiaDelMes(e.target.value)}>
                  <option value="">El de la fecha</option>
                  <OpcionesDia />
                </select>
              </Campo>
            )}
          </div>
        )}
        {quincenal && diaQuincena1 >= diaQuincena2 && (
          <p className="text-xs text-rose-600 dark:text-rose-400">El primer cobro debe ser antes que el segundo.</p>
        )}
        {(quincenal || mensual) && (
          <label className="flex items-center gap-2 text-sm text-suave">
            <input type="checkbox" checked={adelantar} onChange={(e) => setAdelantar(e.target.checked)} className="accent-acento-600" />
            Si cae en fin de semana, adelantar al viernes
          </label>
        )}
      </fieldset>
      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
