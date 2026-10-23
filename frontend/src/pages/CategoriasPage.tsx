import { Plus } from "lucide-react";
import { useState } from "react";

import { categoriasApi } from "../api/recursos";
import { ReglasImportacion } from "../components/categorias/ReglasImportacion";
import { FormularioCategoria } from "../components/formularios/FormularioCategoria";
import { AccionesFila } from "../components/ui/AccionesFila";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido, Vacio } from "../components/ui/Estados";
import { IconoCategoria } from "../components/ui/IconoCategoria";
import { Modal } from "../components/ui/Modal";
import { Tarjeta } from "../components/ui/Tarjeta";
import { confirmarYEliminar } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import type { Categoria, TipoMovimiento } from "../types";

type EstadoModal = null | "nueva" | Categoria;

const PESTANAS: { tipo: TipoMovimiento; etiqueta: string }[] = [
  { tipo: "gasto", etiqueta: "Gastos" },
  { tipo: "ingreso", etiqueta: "Ingresos" },
];

export function CategoriasPage() {
  const [tipo, setTipo] = useState<TipoMovimiento>("gasto");
  const [modal, setModal] = useState<EstadoModal>(null);
  const estado = useDatos(() => categoriasApi.listar({ tipo }), [tipo], "categorias");

  function alGuardar() {
    setModal(null);
    estado.recargar();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Categorías"
        consejo="Las categorías de gasto se pueden presupuestar. Al importar un extracto, la app recuerda qué categoría usaste para cada concepto, y tus reglas mandan sobre lo que recuerda."
        descripcion="Clasifica tus ingresos y gastos"
        acciones={<Boton onClick={() => setModal("nueva")}><Plus size={16} /> Nueva categoría</Boton>}
      />

      <div className="mb-4 inline-flex rounded-xl bg-superficie-2 p-1">
        {PESTANAS.map((pestana) => (
          <button
            key={pestana.tipo}
            type="button"
            onClick={() => setTipo(pestana.tipo)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              tipo === pestana.tipo ? "bg-superficie shadow-sm" : "text-tenue"
            }`}
          >
            {pestana.etiqueta}
          </button>
        ))}
      </div>

      <Tarjeta>
        <Contenido {...estado} onReintentar={estado.recargar}>
          {(categorias) =>
            categorias.length === 0 ? (
              <Vacio mensaje={`No hay categorías de ${tipo}`} />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categorias.map((categoria) => (
                  <li key={categoria.id} className="flex items-center gap-3 rounded-xl border border-linea p-3">
                    <IconoCategoria icono={categoria.icono} color={categoria.color} />
                    <span className="flex-1 truncate font-medium">{categoria.nombre}</span>
                    <AccionesFila
                      onEditar={() => setModal(categoria)}
                      onEliminar={() =>
                        confirmarYEliminar(`¿Eliminar la categoría "${categoria.nombre}"?`, () => categoriasApi.eliminar(categoria.id), estado.recargar)
                      }
                    />
                  </li>
                ))}
              </ul>
            )
          }
        </Contenido>
      </Tarjeta>

      <ReglasImportacion />

      <Modal titulo={modal === "nueva" ? "Nueva categoría" : "Editar categoría"} abierto={modal !== null} onCerrar={() => setModal(null)}>
        {modal !== null && (
          <FormularioCategoria
            key={modal === "nueva" ? "nueva" : modal.id}
            inicial={modal === "nueva" ? undefined : modal}
            tipoInicial={tipo}
            onGuardado={alGuardar}
            onCancelar={() => setModal(null)}
          />
        )}
      </Modal>
    </>
  );
}
