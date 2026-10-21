import {
  Banknote,
  CreditCard,
  Landmark,
  LineChart,
  PiggyBank,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { cuentasApi } from "../../api/recursos";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import type { Cuenta, DatosNuevos, Moneda, TipoCuenta } from "../../types";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { SelectMoneda } from "../ui/SelectMoneda";
import { PieFormulario } from "./PieFormulario";

export const TIPOS_CUENTA: Record<TipoCuenta, { etiqueta: string; icono: LucideIcon }> = {
  efectivo: { etiqueta: "Efectivo", icono: Banknote },
  debito: { etiqueta: "Débito", icono: Landmark },
  credito: { etiqueta: "Tarjeta de crédito", icono: CreditCard },
  rendimientos: { etiqueta: "Rendimientos diarios", icono: TrendingUp },
  ahorro: { etiqueta: "Ahorro", icono: PiggyBank },
  inversion: { etiqueta: "Inversión", icono: LineChart },
};

interface FormularioCuentaProps {
  /** Si se pasa, el formulario edita esa cuenta; si no, crea una nueva. */
  inicial?: Cuenta;
  /** Tipo preseleccionado al crear (p. ej. "efectivo" desde la página de Efectivo). */
  tipoInicial?: TipoCuenta;
  /** Todas las cuentas: si se pasan, se puede elegir de cuál es subcuenta. */
  cuentas?: Cuenta[];
  onGuardado: () => void;
  onCancelar: () => void;
}

/** Convierte "" en null: los campos opcionales vacíos se envían como null. */
const textoONulo = (valor: string) => (valor.trim() === "" ? null : valor);

export function FormularioCuenta({ inicial, tipoInicial, cuentas = [], onGuardado, onCancelar }: FormularioCuentaProps) {
  const { moneda: monedaPrincipal } = useConfiguracion();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoCuenta>(inicial?.tipo ?? tipoInicial ?? "debito");
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda ?? monedaPrincipal);
  // En tarjetas pedimos la deuda en positivo (más natural) y la guardamos en negativo.
  const [importeInicial, setImporteInicial] = useState(() => {
    if (!inicial) return "0";
    const balance = Number(inicial.balance_inicial);
    return String(inicial.tipo === "credito" ? -balance : balance);
  });
  const [diaCorte, setDiaCorte] = useState(String(inicial?.dia_corte ?? ""));
  const [diaPago, setDiaPago] = useState(String(inicial?.dia_pago ?? ""));
  const [limiteCredito, setLimiteCredito] = useState(inicial?.limite_credito ?? "");
  const [tasaAnual, setTasaAnual] = useState(inicial?.tasa_rendimiento_anual ?? "");
  const [padreId, setPadreId] = useState(String(inicial?.cuenta_padre_id ?? ""));
  const [numeroCuenta, setNumeroCuenta] = useState(inicial?.numero_cuenta ?? "");
  const [fijada, setFijada] = useState(inicial?.fijada ?? false);
  // Un solo nivel de subcuentas: la madre no puede ser subcuenta, y una cuenta
  // que ya tiene subcuentas no puede pasar a ser subcuenta de otra.
  const posiblesMadres = cuentas.filter((c) => c.cuenta_padre_id === null && c.id !== inicial?.id);
  const tieneSubcuentas = inicial !== undefined && cuentas.some((c) => c.cuenta_padre_id === inicial.id);
  const { enviando, error, ejecutar } = useEnvio();

  const esCredito = tipo === "credito";
  const esRendimientos = tipo === "rendimientos";

  async function enviar(evento: FormEvent) {
    evento.preventDefault(); // evita que el navegador recargue la página
    const datos: DatosNuevos<Cuenta> = {
      nombre: nombre.trim(),
      tipo,
      moneda,
      balance_inicial: String(esCredito ? -Number(importeInicial) : Number(importeInicial)),
      // El backend borra los campos que no corresponden al tipo; aun así los
      // enviamos a null para que el formulario sea explícito.
      dia_corte: esCredito ? Number(diaCorte) : null,
      dia_pago: esCredito ? Number(diaPago) : null,
      limite_credito: esCredito ? textoONulo(limiteCredito) : null,
      tasa_rendimiento_anual: esRendimientos ? tasaAnual : null,
      cuenta_padre_id: padreId ? Number(padreId) : null,
      numero_cuenta: textoONulo(numeroCuenta),
      fijada,
    };
    const ok = await ejecutar(() =>
      inicial ? cuentasApi.actualizar(inicial.id, datos) : cuentasApi.crear(datos),
    );
    if (ok) onGuardado();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Nombre">
        <input className={CLASE_ENTRADA} value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={100} placeholder="Ej.: BBVA, Nu, Efectivo" autoFocus />
      </Campo>

      <Campo etiqueta="Moneda de la cuenta" ayuda="No se puede cambiar cuando la cuenta ya tiene transacciones.">
        <SelectMoneda valor={moneda} onCambiar={setMoneda} />
      </Campo>

      {posiblesMadres.length > 0 && !tieneSubcuentas && (
        <Campo etiqueta="Subcuenta de" ayuda="Como en Revolut: una cuenta con varias subcuentas, cada una en su divisa y con su saldo.">
          <select className={CLASE_ENTRADA} value={padreId} onChange={(e) => setPadreId(e.target.value)}>
            <option value="">Ninguna (cuenta independiente)</option>
            {posiblesMadres.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
            ))}
          </select>
        </Campo>
      )}

      <Campo etiqueta="Número de cuenta (opcional)" ayuda="IBAN, CLABE o el número que te dé tu banco. Solo para tenerlo a mano.">
        <input className={CLASE_ENTRADA} value={numeroCuenta} onChange={(e) => setNumeroCuenta(e.target.value)} maxLength={50} placeholder="Ej.: ES12 3456 7890 1234 5678 9012" />
      </Campo>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-suave">Tipo de cuenta</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(TIPOS_CUENTA).map(([valor, { etiqueta, icono: Icono }]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setTipo(valor as TipoCuenta)}
              aria-pressed={tipo === valor}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition ${
                tipo === valor
                  ? "border-acento-500 bg-acento-50 text-acento-700 dark:bg-acento-950/50 dark:text-acento-300"
                  : "border-linea text-suave hover:bg-realce"
              }`}
            >
              <Icono size={20} />
              {etiqueta}
            </button>
          ))}
        </div>
      </fieldset>

      {esCredito ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Día de corte" ayuda="Día en que cierra el periodo">
              <input className={CLASE_ENTRADA} type="number" min={1} max={31} value={diaCorte} onChange={(e) => setDiaCorte(e.target.value)} required />
            </Campo>
            <Campo etiqueta="Día límite de pago" ayuda="Día en que hay que pagar">
              <input className={CLASE_ENTRADA} type="number" min={1} max={31} value={diaPago} onChange={(e) => setDiaPago(e.target.value)} required />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Límite de crédito" ayuda="Opcional">
              <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={limiteCredito} onChange={(e) => setLimiteCredito(e.target.value)} />
            </Campo>
            <Campo etiqueta="Deuda actual" ayuda="Lo que debes hoy (0 si nada)">
              <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0" value={importeInicial} onChange={(e) => setImporteInicial(e.target.value)} required />
            </Campo>
          </div>
        </>
      ) : (
        <Campo etiqueta="Saldo inicial" ayuda="Dinero que había en la cuenta antes de empezar a registrar.">
          <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" value={importeInicial} onChange={(e) => setImporteInicial(e.target.value)} required />
        </Campo>
      )}

      {esRendimientos && (
        <Campo etiqueta="Tasa de rendimiento anual (%)" ayuda="La que anuncia tu banco (GAT o tasa anual), p. ej. 10.5">
          <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" max="100" value={tasaAnual} onChange={(e) => setTasaAnual(e.target.value)} required />
        </Campo>
      )}

      <label className="flex items-center gap-2 text-sm text-suave">
        <input type="checkbox" checked={fijada} onChange={(e) => setFijada(e.target.checked)} className="accent-acento-600" />
        Fijar arriba en Cuentas y en el panel
      </label>

      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
