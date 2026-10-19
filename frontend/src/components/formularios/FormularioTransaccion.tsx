import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { transaccionesApi } from "../../api/recursos";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, Cuenta, Moneda, TipoMovimiento, Transaccion } from "../../types";
import { formatearDinero, hoyISO } from "../../utils/formato";
import { SelectMoneda } from "../ui/SelectMoneda";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { CategoriaRapida } from "./CategoriaRapida";
import { PieFormulario } from "./PieFormulario";

interface VistaPreviaProps {
  monto: number;
  de: Moneda;
  a: Moneda | undefined;
}

/** "≈ 2,000.00 en MXN" cuando se paga en una moneda distinta a la de la cuenta. */
function VistaPreviaConversion({ monto, de, a }: VistaPreviaProps) {
  const { convertir } = useConfiguracion();
  if (!a || a === de || !monto) return null;
  const convertido = convertir(monto, de, a);
  return (
    <p className="text-xs text-tenue">
      {convertido === undefined
        ? `Falta la tasa de ${de} o ${a}: añádela en Ajustes.`
        : `≈ ${formatearDinero(convertido, a)} en la cuenta (se guardará con la tasa de su fecha)`}
    </p>
  );
}

interface FormularioTransaccionProps {
  inicial?: Transaccion;
  categorias: Categoria[];
  cuentas: Cuenta[];
  onGuardado: () => void;
  onCancelar: () => void;
}

export function FormularioTransaccion({ inicial, categorias, cuentas, onGuardado, onCancelar }: FormularioTransaccionProps) {
  const { moneda: monedaPrincipal } = useConfiguracion();
  const [tipo, setTipo] = useState<TipoMovimiento>(inicial?.tipo ?? "gasto");
  const [monto, setMonto] = useState(inicial?.monto ?? "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoyISO());
  // Texto (no número) para que "" signifique "sin elegir" y funcione `required`.
  const [categoriaId, setCategoriaId] = useState(inicial ? String(inicial.categoria_id) : "");
  const [cuentaId, setCuentaId] = useState(inicial?.cuenta_id ?? cuentas[0]?.id ?? 0);
  const cuentaDe = (id: number) => cuentas.find((cuenta) => cuenta.id === id);
  // Por defecto, la moneda de la cuenta. Si el usuario elige otra a mano, se
  // respeta aunque después cambie de cuenta.
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda ?? cuentaDe(cuentaId)?.moneda ?? monedaPrincipal);
  const [monedaElegida, setMonedaElegida] = useState(Boolean(inicial));
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const { enviando, error, ejecutar } = useEnvio();
  // Copia local: así una categoría creada aquí aparece al instante en el desplegable.
  const [categoriasLocales, setCategoriasLocales] = useState(categorias);
  const [creandoCategoria, setCreandoCategoria] = useState(false);

  // Solo se ofrecen categorías del mismo tipo (el backend lo exige también).
  const categoriasDelTipo = categoriasLocales.filter((categoria) => categoria.tipo === tipo);

  function cambiarTipo(nuevoTipo: TipoMovimiento) {
    setTipo(nuevoTipo);
    setCategoriaId(""); // la categoría elegida ya no sería válida
  }

  function cambiarCuenta(id: number) {
    setCuentaId(id);
    if (!monedaElegida) setMoneda(cuentaDe(id)?.moneda ?? moneda);
  }

  function elegirMoneda(nueva: Moneda) {
    setMoneda(nueva);
    setMonedaElegida(true);
  }

  function alCrearCategoria(categoria: Categoria) {
    setCategoriasLocales((actuales) => [...actuales, categoria]);
    setCategoriaId(String(categoria.id));
    setCreandoCategoria(false);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const datos = {
      tipo,
      monto,
      moneda,
      fecha,
      categoria_id: Number(categoriaId),
      cuenta_id: cuentaId,
      notas: notas.trim() || null, // texto vacío = sin notas
    };
    const ok = await ejecutar(() =>
      inicial ? transaccionesApi.actualizar(inicial.id, datos) : transaccionesApi.crear(datos),
    );
    if (ok) onGuardado();
  }

  if (cuentas.length === 0) {
    return (
      <p className="text-sm text-suave">
        Primero necesitas una cuenta.{" "}
        <Link to="/cuentas" className="font-medium text-acento-600 hover:underline">Crear cuenta</Link>
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {/* Interruptor gasto/ingreso: lo primero que se decide al anotar un movimiento */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-superficie-2 p-1">
        {(["gasto", "ingreso"] as const).map((opcion) => (
          <button
            key={opcion}
            type="button"
            onClick={() => cambiarTipo(opcion)}
            className={`rounded-lg py-2 text-sm font-medium capitalize transition ${
              tipo === opcion
                ? opcion === "gasto" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                : "text-tenue"
            }`}
          >
            {opcion}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-end gap-1.5">
            <div className="min-w-0 flex-1">
              <Campo etiqueta="Monto">
                <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required autoFocus />
              </Campo>
            </div>
            <SelectMoneda valor={moneda} onCambiar={elegirMoneda} compacta className="w-[5.5rem]" etiqueta="Moneda" />
          </div>
          <VistaPreviaConversion monto={Number(monto)} de={moneda} a={cuentaDe(cuentaId)?.moneda} />
        </div>
        <Campo etiqueta="Fecha">
          <input className={CLASE_ENTRADA} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </Campo>
      </div>

      <div className="space-y-1.5">
        {/* El botón va fuera del <label> para que no forme parte del nombre del campo */}
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Campo etiqueta="Categoría">
              <select className={CLASE_ENTRADA} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
                <option value="" disabled>Elige una categoría…</option>
                {categoriasDelTipo.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
                ))}
              </select>
            </Campo>
          </div>
          <Boton variante="secundario" className="py-2.5" onClick={() => setCreandoCategoria(true)} aria-label="Crear categoría" title="Crear categoría">
            <Plus size={16} />
          </Boton>
        </div>
        {creandoCategoria && (
          <CategoriaRapida tipo={tipo} onCreada={alCrearCategoria} onCancelar={() => setCreandoCategoria(false)} />
        )}
      </div>

      <Campo etiqueta="Cuenta">
        <select className={CLASE_ENTRADA} value={cuentaId} onChange={(e) => cambiarCuenta(Number(e.target.value))}>
          {cuentas.map((cuenta) => (
            <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Notas (opcional)">
        <input className={CLASE_ENTRADA} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej.: compra semanal" />
      </Campo>

      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
