import { useState, type FormEvent } from "react";

import { categoriasApi } from "../../api/recursos";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, TipoMovimiento } from "../../types";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { COLORES, ICONOS } from "../ui/IconoCategoria";
import { PieFormulario } from "./PieFormulario";

interface FormularioCategoriaProps {
  inicial?: Categoria;
  /** Tipo preseleccionado al crear (según la pestaña activa). */
  tipoInicial?: TipoMovimiento;
  onGuardado: () => void;
  onCancelar: () => void;
}

export function FormularioCategoria({ inicial, tipoInicial = "gasto", onGuardado, onCancelar }: FormularioCategoriaProps) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoMovimiento>(inicial?.tipo ?? tipoInicial);
  const [icono, setIcono] = useState(inicial?.icono ?? "circle");
  const [color, setColor] = useState(inicial?.color ?? COLORES[6]);
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const datos = { nombre: nombre.trim(), tipo, icono, color };
    const ok = await ejecutar(() =>
      inicial ? categoriasApi.actualizar(inicial.id, datos) : categoriasApi.crear(datos),
    );
    if (ok) onGuardado();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Nombre">
        <input className={CLASE_ENTRADA} value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={50} autoFocus />
      </Campo>

      <Campo etiqueta="Tipo">
        <select className={CLASE_ENTRADA} value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento)}>
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </select>
      </Campo>

      {/* Selectores visuales: un <fieldset> agrupa botones que actúan como opciones */}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-suave">Icono</legend>
        <div className="grid grid-cols-8 gap-1.5">
          {Object.entries(ICONOS).map(([nombreIcono, Icono]) => (
            <button
              key={nombreIcono}
              type="button"
              onClick={() => setIcono(nombreIcono)}
              aria-label={nombreIcono}
              aria-pressed={icono === nombreIcono}
              className={`flex h-9 items-center justify-center rounded-lg border transition ${
                icono === nombreIcono
                  ? "border-transparent text-white"
                  : "border-linea text-tenue hover:bg-realce"
              }`}
              style={icono === nombreIcono ? { backgroundColor: color } : undefined}
            >
              <Icono size={16} />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-suave">Color</legend>
        <div className="flex flex-wrap gap-2">
          {COLORES.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setColor(opcion)}
              aria-label={`Color ${opcion}`}
              aria-pressed={color === opcion}
              className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-superficie transition ${
                color === opcion ? "ring-2 ring-texto " : ""
              }`}
              style={{ backgroundColor: opcion }}
            />
          ))}
        </div>
      </fieldset>

      <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} />
    </form>
  );
}
