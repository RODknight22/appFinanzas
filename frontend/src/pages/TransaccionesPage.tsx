import { Plus, Upload } from "lucide-react";
import { useState } from "react";

import { categoriasApi, cuentasApi, transaccionesApi } from "../api/recursos";
import { FormularioTransaccion } from "../components/formularios/FormularioTransaccion";
import { ImportarExtracto } from "../components/importacion/ImportarExtracto";
import { BarraFiltros } from "../components/transacciones/BarraFiltros";
import { FilaTransaccion } from "../components/transacciones/FilaTransaccion";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Cargando, Contenido, MensajeError, Vacio } from "../components/ui/Estados";
import { Modal } from "../components/ui/Modal";
import { Paginacion } from "../components/ui/Paginacion";
import { Tarjeta } from "../components/ui/Tarjeta";
import { confirmarYEliminar } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import { aConsulta, POR_PAGINA, useFiltrosTransacciones } from "../hooks/useFiltrosTransacciones";
import type { Transaccion } from "../types";
import { formatearDinero } from "../utils/formato";

type EstadoModal = null | "nueva" | "importar" | Transaccion;

export function TransaccionesPage() {
  const { filtros, cambiar, limpiar } = useFiltrosTransacciones();
  const [modal, setModal] = useState<EstadoModal>(null);

  // Categorías y cuentas se cargan una vez; los resultados, con cada cambio de filtros.
  // JSON.stringify: una dependencia que solo cambia cuando cambia algún filtro.
  const catalogos = useDatos(() => Promise.all([categoriasApi.listar(), cuentasApi.listar()]), []);
  const consulta = aConsulta(filtros);
  const resultados = useDatos(() => transaccionesApi.buscar(consulta), [JSON.stringify(consulta)]);

  function alGuardar() {
    setModal(null);
    resultados.recargar();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Transacciones"
        descripcion="Tus ingresos y gastos registrados"
        acciones={
          <>
            <Boton variante="secundario" onClick={() => setModal("importar")}><Upload size={16} /> Importar</Boton>
            <Boton onClick={() => setModal("nueva")}><Plus size={16} /> Nueva</Boton>
          </>
        }
      />

      <Contenido {...catalogos} onReintentar={catalogos.recargar}>
        {([categorias, cuentas]) => {
          // Map: búsqueda por id en O(1) en lugar de recorrer la lista en cada fila.
          const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
          const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
          const pagina = resultados.datos;

          return (
            <>
              <BarraFiltros filtros={filtros} cuentas={cuentas} categorias={categorias} onCambiar={cambiar} onLimpiar={limpiar} />

              {pagina && (
                <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>Ingresos: <strong className="text-emerald-600 tabular-nums">{formatearDinero(pagina.total_ingresos)}</strong></span>
                  <span>Gastos: <strong className="text-rose-600 tabular-nums">{formatearDinero(pagina.total_gastos)}</strong></span>
                  <span className="text-tenue">{pagina.total} movimiento{pagina.total === 1 ? "" : "s"}</span>
                </div>
              )}

              <Tarjeta>
                {resultados.error ? (
                  <MensajeError mensaje={resultados.error} onReintentar={resultados.recargar} />
                ) : !pagina ? (
                  <Cargando />
                ) : pagina.total === 0 ? (
                  <Vacio
                    mensaje="No hay transacciones con estos filtros"
                    accion={<Boton variante="secundario" onClick={() => setModal("nueva")}>Registrar una</Boton>}
                  />
                ) : (
                  // Mientras llegan resultados nuevos se atenúan los anteriores en vez de
                  // mostrar "Cargando…": así la lista no parpadea al escribir.
                  <div className={`transition-opacity ${resultados.cargando ? "opacity-50" : ""}`}>
                    <ul className="divide-y divide-linea">
                      {pagina.items.map((transaccion) => (
                        <FilaTransaccion
                          key={transaccion.id}
                          transaccion={transaccion}
                          categoria={categoriaPorId.get(transaccion.categoria_id)}
                          cuenta={cuentaPorId.get(transaccion.cuenta_id)}
                          onEditar={() => setModal(transaccion)}
                          onEliminar={() =>
                            confirmarYEliminar("¿Eliminar esta transacción?", () => transaccionesApi.eliminar(transaccion.id), resultados.recargar)
                          }
                        />
                      ))}
                    </ul>
                    <Paginacion pagina={filtros.pagina} porPagina={POR_PAGINA} total={pagina.total} onCambiar={(n) => cambiar({ pagina: n })} />
                  </div>
                )}
              </Tarjeta>

              <Modal titulo="Importar extracto bancario" ancho="amplio" abierto={modal === "importar"} onCerrar={() => setModal(null)}>
                <ImportarExtracto
                  cuentas={cuentas}
                  categorias={categorias}
                  cuentaInicial={consulta.cuenta_id}
                  onImportado={resultados.recargar}
                  onCerrar={() => setModal(null)}
                />
              </Modal>

              <Modal
                titulo={modal === "nueva" ? "Nueva transacción" : "Editar transacción"}
                abierto={modal !== null && modal !== "importar"}
                onCerrar={() => setModal(null)}
              >
                {modal !== null && modal !== "importar" && (
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
