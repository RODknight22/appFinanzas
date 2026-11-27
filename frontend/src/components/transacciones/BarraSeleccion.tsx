import { Trash2 } from "lucide-react";
import { useState } from "react";

import { transaccionesApi } from "../../api/recursos";
import type { CambiosLote, Categoria, Cuenta, Transaccion } from "../../types";
import { avisarError } from "../ajustes/avisarError";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA_BASE } from "../ui/Campo";
import { avisar, confirmar } from "../ui/tablonAvisos";

interface BarraSeleccionProps {
  /** Las transacciones marcadas (solo las visibles: nunca se toca lo que no se ve). */
  seleccionadas: Transaccion[];
  cuentas: Cuenta[];
  categorias: Categoria[];
  /** Tras cambiar o borrar: recargar la lista y vaciar la selección. */
  onHecho: () => void;
}

const plural = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? "" : "s"}`;

/**
 * Acciones sobre varias transacciones a la vez: cambiar cuenta o categoría y eliminar.
 * El backend aplica todo o nada: si una no se puede cambiar, no cambia ninguna.
 */
export function BarraSeleccion({ seleccionadas, cuentas, categorias, onHecho }: BarraSeleccionProps) {
  const [ocupado, setOcupado] = useState(false);
  const n = seleccionadas.length;
  const ids = seleccionadas.map((t) => t.id);
  // Una categoría es de ingreso o de gasto: con una mezcla, ninguna vale para todas.
  const tipos = new Set(seleccionadas.map((t) => t.tipo));
  const tipo = tipos.size === 1 ? [...tipos][0] : null;
  const desactivada = n === 0 || ocupado;

  async function aplicar(cambios: CambiosLote, mensaje: string) {
    setOcupado(true);
    try {
      await transaccionesApi.actualizarLote(ids, cambios);
      avisar(mensaje);
      onHecho();
    } catch (e) {
      avisarError(e);
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarCuenta(cuenta: Cuenta) {
    // En otra moneda el saldo cambia de unidad: mejor que no pille por sorpresa.
    const monedas = new Set(seleccionadas.map((t) => cuentas.find((c) => c.id === t.cuenta_id)?.moneda));
    if (
      [...monedas].some((m) => m !== cuenta.moneda) &&
      !(await confirmar(
        `${cuenta.nombre} está en ${cuenta.moneda}: el importe de ${plural(n, "movimiento")} se convertirá con la tasa de su fecha. ¿Moverlos?`,
        { textoAceptar: "Mover" },
      ))
    ) {
      return;
    }
    await aplicar({ cuenta_id: cuenta.id }, `${plural(n, "movimiento")} en ${cuenta.nombre}`);
  }

  async function eliminar() {
    const cuantas = n === 1 ? "1 transacción" : `${n} transacciones`;
    const aceptado = await confirmar(`¿Eliminar ${cuantas}? No se puede deshacer.`, { textoAceptar: "Eliminar", peligro: true });
    if (!aceptado) return;
    setOcupado(true);
    try {
      const { afectadas } = await transaccionesApi.eliminarLote(ids);
      avisar(afectadas === 1 ? "1 transacción eliminada" : `${afectadas} transacciones eliminadas`);
      onHecho();
    } catch (e) {
      avisarError(e);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div role="group" aria-label="Acciones con la selección" className="flex flex-wrap items-center gap-2">
      {/* value="": el desplegable es un menú; tras elegir vuelve a su texto */}
      <select
        className={`${CLASE_ENTRADA_BASE} min-w-0 flex-1 basis-40`}
        value=""
        disabled={desactivada}
        aria-label="Cambiar cuenta"
        onChange={(e) => {
          const cuenta = cuentas.find((c) => c.id === Number(e.target.value));
          if (cuenta) void cambiarCuenta(cuenta);
        }}
      >
        <option value="">Cambiar cuenta…</option>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
        ))}
      </select>
      <select
        className={`${CLASE_ENTRADA_BASE} min-w-0 flex-1 basis-40`}
        value=""
        disabled={desactivada || tipo === null}
        aria-label="Cambiar categoría"
        title={n > 0 && tipo === null ? "Hay ingresos y gastos: elige solo de un tipo para cambiar la categoría" : undefined}
        onChange={(e) => {
          const categoria = categorias.find((c) => c.id === Number(e.target.value));
          if (categoria) void aplicar({ categoria_id: categoria.id }, `${plural(n, "movimiento")} en ${categoria.nombre}`);
        }}
      >
        <option value="">{n > 0 && tipo === null ? "Categoría: ingresos y gastos mezclados" : "Cambiar categoría…"}</option>
        {categorias
          .filter((c) => c.tipo === tipo)
          .map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
      </select>
      <Boton variante="peligro" onClick={eliminar} disabled={desactivada}>
        <Trash2 size={16} /> Eliminar
      </Boton>
    </div>
  );
}
