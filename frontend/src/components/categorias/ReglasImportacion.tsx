import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { categoriasApi, reglasCategoriaApi } from "../../api/recursos";
import { useDatos } from "../../hooks/useDatos";
import { useEnvio } from "../../hooks/useEnvio";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, ErrorFormulario } from "../ui/Campo";
import { Contenido } from "../ui/Estados";
import { IconoCategoria } from "../ui/IconoCategoria";
import { Tarjeta } from "../ui/Tarjeta";

/**
 * Reglas para importar extractos: "si el concepto contiene MERCADONA, es Supermercado".
 * Sirven para lo que la app no puede aprender sola (comercios nuevos o conceptos que
 * cambian cada vez) y mandan sobre lo que recuerda del historial.
 */
export function ReglasImportacion() {
  const estado = useDatos(() => Promise.all([reglasCategoriaApi.listar(), categoriasApi.listar()]), [], "reglas-importacion");
  const [texto, setTexto] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const envio = useEnvio();

  async function anadir(evento: FormEvent) {
    evento.preventDefault();
    const ok = await envio.ejecutar(() => reglasCategoriaApi.crear({ texto: texto.trim(), categoria_id: Number(categoriaId) }));
    if (ok) {
      setTexto("");
      estado.recargar();
    }
  }

  // Sin confirmación: una regla se vuelve a crear en un momento y no borra ningún movimiento.
  async function borrar(id: number) {
    if (await envio.ejecutar(() => reglasCategoriaApi.eliminar(id))) estado.recargar();
  }

  return (
    <Tarjeta titulo="Reglas al importar" className="mt-6">
      <p className="mb-4 text-sm text-tenue">
        Si el concepto de un movimiento contiene el texto, se le pone esa categoría. Sin importar tildes ni mayúsculas, y
        mandan sobre lo que la app aprende sola.
      </p>
      <Contenido {...estado} onReintentar={estado.recargar}>
        {([reglas, categorias]) => {
          const porId = new Map(categorias.map((c) => [c.id, c]));
          return (
            <>
              {reglas.length > 0 && (
                <ul className="mb-4 divide-y divide-linea">
                  {reglas.map((regla) => {
                    const categoria = porId.get(regla.categoria_id);
                    return (
                      <li key={regla.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm">
                        <span className="font-medium">«{regla.texto}»</span>
                        <ArrowRight size={14} className="text-tenue-2" aria-label="se clasifica como" />
                        {categoria && <IconoCategoria icono={categoria.icono} color={categoria.color} />}
                        <span className="flex-1">
                          {categoria?.nombre}{" "}
                          <span className="text-tenue">({categoria?.tipo === "ingreso" ? "ingreso" : "gasto"})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => borrar(regla.id)}
                          aria-label={`Borrar la regla «${regla.texto}»`}
                          className="rounded-lg p-1.5 text-tenue-2 transition-colors hover:bg-realce hover:text-peligro"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <form onSubmit={anadir} className="flex flex-wrap items-center gap-2">
                <input
                  className={`${CLASE_ENTRADA} min-w-0 flex-1 basis-40`}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Ej.: MERCADONA"
                  aria-label="Texto que contiene el concepto"
                  maxLength={100}
                />
                <select
                  className={`${CLASE_ENTRADA} min-w-0 flex-1 basis-40`}
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  aria-label="Categoría de la regla"
                >
                  <option value="" disabled>Categoría…</option>
                  {(["gasto", "ingreso"] as const).map((tipo) => (
                    <optgroup key={tipo} label={tipo === "gasto" ? "Gastos" : "Ingresos"}>
                      {categorias.filter((c) => c.tipo === tipo).map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <Boton type="submit" disabled={envio.enviando || texto.trim().length < 2 || !categoriaId}>
                  <Plus size={16} /> Añadir regla
                </Boton>
              </form>
              <ErrorFormulario mensaje={envio.error} />
            </>
          );
        }}
      </Contenido>
    </Tarjeta>
  );
}
