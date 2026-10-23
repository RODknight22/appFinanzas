import { useRef, useState, type FormEvent } from "react";

import { transaccionesApi } from "../../api/recursos";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, Cuenta } from "../../types";
import { hoyISO } from "../../utils/formato";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, Campo, ErrorFormulario } from "../ui/Campo";
import { RejillaCategorias } from "./RejillaCategorias";

interface FormularioGastoRapidoProps {
  /** Cuentas de efectivo; la primera es la elegida por defecto. */
  carteras: Cuenta[];
  /** Categorías de gasto, las más usadas primero. */
  categorias: Categoria[];
  onGuardado: () => void;
  onCancelar: () => void;
}

/**
 * Anotar un gasto en efectivo en dos toques: el importe y la categoría.
 * Tocar la categoría guarda directamente (fecha de hoy, en la moneda de la cartera).
 */
export function FormularioGastoRapido({ carteras, categorias, onGuardado, onCancelar }: FormularioGastoRapidoProps) {
  const [monto, setMonto] = useState("");
  const [carteraId, setCarteraId] = useState(carteras[0]?.id ?? 0);
  const [notas, setNotas] = useState("");
  const formulario = useRef<HTMLFormElement>(null);
  const { enviando, error, ejecutar } = useEnvio();
  const cartera = carteras.find((c) => c.id === carteraId);

  async function guardar(categoriaId: number) {
    // Muestra el aviso nativo del navegador si falta el importe o no es válido.
    if (!cartera || !formulario.current?.reportValidity()) return;
    const ok = await ejecutar(() =>
      transaccionesApi.crear({
        monto,
        moneda: cartera.moneda,
        tipo: "gasto",
        fecha: hoyISO(),
        notas: notas.trim() || null,
        categoria_id: categoriaId,
        cuenta_id: cartera.id,
      }),
    );
    if (ok) onGuardado();
  }

  // Enter en el importe no hace nada: falta saber la categoría.
  const evitarEnvio = (evento: FormEvent) => evento.preventDefault();

  return (
    <form ref={formulario} onSubmit={evitarEnvio} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-suave">Importe ({cartera?.moneda})</span>
        <input
          className={`${CLASE_ENTRADA} text-2xl font-semibold tabular-nums`}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          required
          autoFocus
          placeholder="0.00"
        />
      </label>

      {carteras.length > 1 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cartera">
          {carteras.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === carteraId}
              onClick={() => setCarteraId(c.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
                c.id === carteraId ? "bg-acento-600 text-white ring-acento-600" : "bg-superficie-2 text-suave ring-linea hover:bg-realce"
              }`}
            >
              {c.nombre} · {c.moneda}
            </button>
          ))}
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-suave">Toca la categoría para guardar</p>
        <RejillaCategorias categorias={categorias} deshabilitada={enviando} onElegir={(categoria) => guardar(categoria.id)} />
      </div>

      <Campo etiqueta="Nota (opcional)">
        <input className={CLASE_ENTRADA} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej.: tacos, mercado, propina" />
      </Campo>

      <ErrorFormulario mensaje={error} />
      <div className="flex justify-end">
        <Boton variante="secundario" onClick={onCancelar}>Cancelar</Boton>
      </div>
    </form>
  );
}
