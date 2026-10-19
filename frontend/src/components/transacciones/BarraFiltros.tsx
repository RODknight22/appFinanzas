import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";

import { FILTROS_AVANZADOS, useValorRetrasado, type Filtros } from "../../hooks/useFiltrosTransacciones";
import type { Categoria, Cuenta, TipoMovimiento } from "../../types";
import { mesActual } from "../../utils/formato";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, CLASE_ENTRADA_BASE, Campo } from "../ui/Campo";
import { SelectorMes } from "../ui/SelectorMes";

interface BarraFiltrosProps {
  filtros: Filtros;
  cuentas: Cuenta[];
  categorias: Categoria[];
  onCambiar: (cambios: Partial<Filtros>) => void;
  onLimpiar: () => void;
}

/** Buscador, periodo y tipo siempre visibles; cuenta, categoría e importe en un panel desplegable. */
export function BarraFiltros({ filtros, cuentas, categorias, onCambiar, onLimpiar }: BarraFiltrosProps) {
  // El texto se guarda aquí al instante (para que el input responda) y llega
  // a la URL 300 ms después de dejar de escribir.
  const [texto, setTexto] = useState(filtros.texto);
  const textoRetrasado = useValorRetrasado(texto, 300);
  useEffect(() => {
    if (textoRetrasado !== filtros.texto) onCambiar({ texto: textoRetrasado });
    // Solo debe reaccionar al texto ya retrasado, no a cada cambio de filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoRetrasado]);

  const avanzadosActivos = FILTROS_AVANZADOS.filter((clave) => filtros[clave] !== "").length;
  const [abierto, setAbierto] = useState(avanzadosActivos > 0);
  const hayFiltros = avanzadosActivos > 0 || filtros.texto !== "" || filtros.tipo !== "";
  // Solo las categorías del tipo elegido (si se eligió alguno).
  const categoriasVisibles = categorias.filter((c) => !filtros.tipo || c.tipo === filtros.tipo);

  function limpiar() {
    setTexto("");
    onLimpiar();
  }

  function cambiarTipo(tipo: TipoMovimiento | "") {
    // Una categoría de gastos no tiene sentido al filtrar por ingresos.
    const categoria = categorias.find((c) => String(c.id) === filtros.categoria);
    onCambiar({ tipo, ...(tipo && categoria && categoria.tipo !== tipo ? { categoria: "" } : {}) });
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Buscar</span>
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className={`${CLASE_ENTRADA} pl-9`}
            placeholder="Buscar en notas o categorías…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={100}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {filtros.periodo === "todo" ? (
            <Boton variante="secundario" onClick={() => onCambiar({ periodo: mesActual() })}>Ver por mes</Boton>
          ) : (
            <>
              <SelectorMes mes={filtros.periodo} onCambiar={(periodo) => onCambiar({ periodo })} />
              <Boton variante="secundario" onClick={() => onCambiar({ periodo: "todo" })}>Todo</Boton>
            </>
          )}
          <select
            className={`${CLASE_ENTRADA_BASE} w-auto`}
            value={filtros.tipo}
            onChange={(e) => cambiarTipo(e.target.value as TipoMovimiento | "")}
            aria-label="Filtrar por tipo"
          >
            <option value="">Todos</option>
            <option value="gasto">Gastos</option>
            <option value="ingreso">Ingresos</option>
          </select>
          <Boton variante="secundario" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
            <SlidersHorizontal size={16} /> Filtros
            {avanzadosActivos > 0 && (
              <span className="rounded-full bg-acento-600 px-1.5 text-xs font-semibold text-white">{avanzadosActivos}</span>
            )}
          </Boton>
          {hayFiltros && (
            <Boton variante="fantasma" onClick={limpiar}>
              <X size={16} /> Limpiar
            </Boton>
          )}
        </div>
      </div>

      {abierto && (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
          <Campo etiqueta="Cuenta">
            <select className={CLASE_ENTRADA} value={filtros.cuenta} onChange={(e) => onCambiar({ cuenta: e.target.value })}>
              <option value="">Todas</option>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Categoría">
            <select className={CLASE_ENTRADA} value={filtros.categoria} onChange={(e) => onCambiar({ categoria: e.target.value })}>
              <option value="">Todas</option>
              {categoriasVisibles.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          {/* Importes en la moneda en que se anotó cada movimiento */}
          <Campo etiqueta="Importe mínimo">
            <input className={CLASE_ENTRADA} type="number" inputMode="decimal" min="0" step="0.01" value={filtros.min} onChange={(e) => onCambiar({ min: e.target.value })} placeholder="0" />
          </Campo>
          <Campo etiqueta="Importe máximo">
            <input className={CLASE_ENTRADA} type="number" inputMode="decimal" min="0" step="0.01" value={filtros.max} onChange={(e) => onCambiar({ max: e.target.value })} placeholder="Sin límite" />
          </Campo>
        </div>
      )}
    </div>
  );
}
