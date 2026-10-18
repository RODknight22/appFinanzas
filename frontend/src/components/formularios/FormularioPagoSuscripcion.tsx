import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { suscripcionesApi } from "../../api/recursos";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, Cuenta, Suscripcion } from "../../types";
import { formatearDinero, formatearFecha } from "../../utils/formato";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { PieFormulario } from "./PieFormulario";

interface FormularioPagoSuscripcionProps {
  suscripcion: Suscripcion;
  cuentas: Cuenta[];
  categoriasGasto: Categoria[];
  onGuardado: () => void;
  onCancelar: () => void;
}

/** Confirma el cobro: crea el gasto y la suscripción pasa a su siguiente fecha. */
export function FormularioPagoSuscripcion({ suscripcion, cuentas, categoriasGasto, onGuardado, onCancelar }: FormularioPagoSuscripcionProps) {
  const [cuentaId, setCuentaId] = useState(String(cuentas[0]?.id ?? ""));
  const [categoriaId, setCategoriaId] = useState("");
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const ok = await ejecutar(() =>
      suscripcionesApi.registrarPago(suscripcion.id, {
        cuenta_id: Number(cuentaId),
        categoria_id: Number(categoriaId),
      }),
    );
    if (ok) onGuardado();
  }

  if (cuentas.length === 0 || categoriasGasto.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Necesitas al menos una <Link to="/cuentas" className="font-medium text-acento-600 hover:underline">cuenta</Link> y una{" "}
        <Link to="/categorias" className="font-medium text-acento-600 hover:underline">categoría de gasto</Link>.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <p className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
        Se registrará un gasto de <strong>{formatearDinero(suscripcion.monto, suscripcion.moneda)}</strong> con fecha{" "}
        <strong>{formatearFecha(suscripcion.fecha_proximo_pago)}</strong> y el próximo cobro se moverá al siguiente periodo.
      </p>
      <Campo etiqueta="Cuenta de cargo">
        <select className={CLASE_ENTRADA} value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} required>
          {cuentas.map((cuenta) => (
            <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Categoría">
        <select className={CLASE_ENTRADA} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
          <option value="" disabled>Elige una categoría…</option>
          {categoriasGasto.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
          ))}
        </select>
      </Campo>
      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} textoGuardar="Registrar pago" />
    </form>
  );
}
