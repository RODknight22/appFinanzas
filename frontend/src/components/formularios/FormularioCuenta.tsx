import { useState, type FormEvent } from "react";

import { cuentasApi } from "../../api/recursos";
import { useEnvio } from "../../hooks/useEnvio";
import type { Cuenta, TipoCuenta } from "../../types";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { PieFormulario } from "./PieFormulario";

export const TIPOS_CUENTA: Record<TipoCuenta, string> = {
  efectivo: "Efectivo",
  banco: "Banco",
  tarjeta: "Tarjeta",
  ahorro: "Ahorro",
  inversion: "Inversión",
};

interface FormularioCuentaProps {
  /** Si se pasa, el formulario edita esa cuenta; si no, crea una nueva. */
  inicial?: Cuenta;
  onGuardado: () => void;
  onCancelar: () => void;
}

export function FormularioCuenta({ inicial, onGuardado, onCancelar }: FormularioCuentaProps) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoCuenta>(inicial?.tipo ?? "banco");
  const [balanceInicial, setBalanceInicial] = useState(inicial?.balance_inicial ?? "0");
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento: FormEvent) {
    evento.preventDefault(); // evita que el navegador recargue la página
    const datos = { nombre: nombre.trim(), tipo, balance_inicial: balanceInicial };
    const ok = await ejecutar(() =>
      inicial ? cuentasApi.actualizar(inicial.id, datos) : cuentasApi.crear(datos),
    );
    if (ok) onGuardado();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Nombre">
        <input className={CLASE_ENTRADA} value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={100} autoFocus />
      </Campo>
      <Campo etiqueta="Tipo">
        <select className={CLASE_ENTRADA} value={tipo} onChange={(e) => setTipo(e.target.value as TipoCuenta)}>
          {Object.entries(TIPOS_CUENTA).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>{etiqueta}</option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Balance inicial" ayuda="Dinero que había en la cuenta antes de empezar a registrar. Puede ser negativo (deuda).">
        <input className={CLASE_ENTRADA} type="number" step="0.01" value={balanceInicial} onChange={(e) => setBalanceInicial(e.target.value)} required />
      </Campo>
      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
