import { useState, type KeyboardEvent } from "react";

import { categoriasApi } from "../../api/recursos";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, TipoMovimiento } from "../../types";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA_BASE, ErrorFormulario } from "../ui/Campo";

interface CategoriaRapidaProps {
  tipo: TipoMovimiento;
  onCreada: (categoria: Categoria) => void;
  onCancelar: () => void;
}

/**
 * Crea una categoría sin salir del formulario de transacción (solo el nombre;
 * el icono y el color se pueden cambiar después en la página de Categorías).
 *
 * No usa <form>: HTML no permite un formulario dentro de otro.
 */
export function CategoriaRapida({ tipo, onCreada, onCancelar }: CategoriaRapidaProps) {
  const [nombre, setNombre] = useState("");
  const { enviando, error, ejecutar } = useEnvio();

  async function crear() {
    if (!nombre.trim()) return;
    let creada: Categoria | undefined;
    const ok = await ejecutar(async () => {
      creada = await categoriasApi.crear({ nombre: nombre.trim(), tipo, icono: "circle", color: "#64748b" });
    });
    if (ok && creada) onCreada(creada);
  }

  function alPulsarTecla(evento: KeyboardEvent<HTMLInputElement>) {
    // Enter crearía la categoría y, además, enviaría el formulario de fuera.
    if (evento.key === "Enter") {
      evento.preventDefault();
      crear();
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-linea-fuerte p-3">
      <div className="flex gap-2">
        <input
          className={`${CLASE_ENTRADA_BASE} min-w-0 flex-1`}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={alPulsarTecla}
          placeholder={`Nueva categoría de ${tipo}`}
          maxLength={50}
          aria-label="Nombre de la nueva categoría"
          autoFocus
        />
        <Boton onClick={crear} disabled={enviando || !nombre.trim()}>Crear</Boton>
        <Boton variante="fantasma" onClick={onCancelar}>Cancelar</Boton>
      </div>
      <ErrorFormulario mensaje={error} />
    </div>
  );
}
