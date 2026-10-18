import { Plus } from "lucide-react";
import { useState } from "react";

import { categoriasApi, cuentasApi, transaccionesApi } from "../api/recursos";
import { FormularioTransaccion } from "../components/formularios/FormularioTransaccion";
import { AccionesFila } from "../components/ui/AccionesFila";
import { Boton } from "../components/ui/Boton";
import { CLASE_ENTRADA } from "../components/ui/Campo";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido, Vacio } from "../components/ui/Estados";
import { IconoCategoria } from "../components/ui/IconoCategoria";
import { Modal } from "../components/ui/Modal";
import { SelectorMes } from "../components/ui/SelectorMes";
import { Tarjeta } from "../components/ui/Tarjeta";
import { confirmarYEliminar } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import type { TipoMovimiento, Transaccion } from "../types";
import { formatearDinero, formatearFecha, mesActual, rangoDelMes } from "../utils/formato";

type EstadoModal = null | "nueva" | Transaccion;

export function TransaccionesPage() {
  const [mes, setMes] = useState(mesActual());
  const [tipo, setTipo] = useState<TipoMovimiento | "">("");
  const [modal, setModal] = useState<EstadoModal>(null);

  // Las transacciones dependen de los filtros; categorías y cuentas se usan
  // para mostrar nombres e iconos y para rellenar el formulario.
  const estado = useDatos(
    () =>
      Promise.all([
        transaccionesApi.listar({ ...rangoDelMes(mes), tipo: tipo || undefined, limit: 500 }),
        categoriasApi.listar(),
        cuentasApi.listar(),
      ]),
    [mes, tipo],
  );

  function alGuardar() {
    setModal(null);
    estado.recargar();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Transacciones"
        descripcion="Tus ingresos y gastos registrados"
        acciones={
          <>
            <SelectorMes mes={mes} onCambiar={setMes} />
            <select className={`${CLASE_ENTRADA} w-auto`} value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento | "")} aria-label="Filtrar por tipo">
              <option value="">Todos</option>
              <option value="gasto">Gastos</option>
              <option value="ingreso">Ingresos</option>
            </select>
            <Boton onClick={() => setModal("nueva")}><Plus size={16} /> Nueva</Boton>
          </>
        }
      />

      <Contenido {...estado} onReintentar={estado.recargar}>
        {([transacciones, categorias, cuentas]) => {
          // Map: búsqueda por id en O(1) en lugar de recorrer la lista en cada fila.
          const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
          const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
          const sumar = (t: TipoMovimiento) =>
            transacciones.filter((x) => x.tipo === t).reduce((total, x) => total + Number(x.monto), 0);

          return (
            <>
              <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span>Ingresos: <strong className="text-emerald-600 tabular-nums">{formatearDinero(sumar("ingreso"))}</strong></span>
                <span>Gastos: <strong className="text-rose-600 tabular-nums">{formatearDinero(sumar("gasto"))}</strong></span>
                <span className="text-slate-500">{transacciones.length} movimientos</span>
              </div>

              <Tarjeta>
                {transacciones.length === 0 ? (
                  <Vacio
                    mensaje="No hay transacciones en este periodo"
                    accion={<Boton variante="secundario" onClick={() => setModal("nueva")}>Registrar la primera</Boton>}
                  />
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {transacciones.map((transaccion) => {
                      const categoria = categoriaPorId.get(transaccion.categoria_id);
                      const esGasto = transaccion.tipo === "gasto";
                      return (
                        <li key={transaccion.id} className="flex items-center gap-3 py-3">
                          <IconoCategoria icono={categoria?.icono ?? "circle"} color={categoria?.color ?? "#64748b"} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{categoria?.nombre ?? "Sin categoría"}</p>
                            <p className="truncate text-xs text-slate-500">
                              {formatearFecha(transaccion.fecha)} · {cuentaPorId.get(transaccion.cuenta_id)?.nombre}
                              {transaccion.notas && ` · ${transaccion.notas}`}
                            </p>
                          </div>
                          <span className={`font-semibold tabular-nums ${esGasto ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {esGasto ? "−" : "+"}{formatearDinero(transaccion.monto)}
                          </span>
                          <AccionesFila
                            onEditar={() => setModal(transaccion)}
                            onEliminar={() =>
                              confirmarYEliminar("¿Eliminar esta transacción?", () => transaccionesApi.eliminar(transaccion.id), estado.recargar)
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Tarjeta>

              <Modal titulo={modal === "nueva" ? "Nueva transacción" : "Editar transacción"} abierto={modal !== null} onCerrar={() => setModal(null)}>
                {modal !== null && (
                  <FormularioTransaccion
                    key={modal === "nueva" ? "nueva" : modal.id}
                    inicial={modal === "nueva" ? undefined : modal}
                    categorias={categorias}
                    cuentas={cuentas}
                    onGuardado={alGuardar}
                    onCancelar={() => setModal(null)}
                  />
                )}
              </Modal>
            </>
          );
        }}
      </Contenido>
    </>
  );
}
