import { Plus, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import { categoriasApi, cuentasApi, transaccionesApi } from "../api/recursos";
import { FormularioRegistroRapido } from "../components/formularios/FormularioRegistroRapido";
import { FormularioTransaccion } from "../components/formularios/FormularioTransaccion";
import { ImportarExtracto } from "../components/importacion/ImportarExtracto";
import { BarraFiltros } from "../components/transacciones/BarraFiltros";
import { FilaTransaccion } from "../components/transacciones/FilaTransaccion";
import { Boton } from "../components/ui/Boton";
import { Consejo } from "../components/ui/Consejo";
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
  const catalogos = useDatos(() => Promise.all([categoriasApi.listar(), cuentasApi.listar()]), [], "transacciones-catalogos");
  const consulta = aConsulta(filtros);
  const resultados = useDatos(() => transaccionesApi.buscar(consulta), [JSON.stringify(consulta)], "transacciones");

  // Una página que ya no existe (se borró lo último de ella o la URL es vieja): a la última que sí.
  const sinFilas = resultados.datos?.items.length === 0;
  const total = resultados.datos?.total ?? 0;
  useEffect(() => {
    if (resultados.cargando || !sinFilas || total === 0 || filtros.pagina <= 1) return;
    cambiar({ pagina: Math.ceil(total / POR_PAGINA) });
  }, [resultados.cargando, sinFilas, total, filtros.pagina, cambiar]);

  function alGuardar() {
    setModal(null);
    resultados.recargar();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Transacciones"
        consejo="Busca sin preocuparte por las tildes. Los filtros quedan en la dirección de la página: guárdala en favoritos para volver a esa vista. Con «Importar» cargas el extracto CSV o Excel de tu banco."
        descripcion="Tus ingresos y gastos registrados"
        acciones={
          <>
            <Boton variante="secundario" onClick={() => setModal("importar")}><Upload size={16} /> Importar</Boton>
            <Consejo alinear="fin" texto="Descarga los movimientos desde la web de tu banco (CSV o Excel) e impórtalos: verás una vista previa, los duplicados se marcan solos y nada se guarda hasta que confirmes." />
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
                  <span>Ingresos: <strong className="text-ingreso tabular-nums">{formatearDinero(pagina.total_ingresos)}</strong></span>
                  <span>Gastos: <strong className="text-gasto tabular-nums">{formatearDinero(pagina.total_gastos)}</strong></span>
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
                {/* Nueva: dos toques y sin cerrar al guardar. Editar: el formulario completo. */}
                {modal === "nueva" && (
                  <FormularioRegistroRapido
                    categorias={categorias}
                    cuentas={cuentas}
                    cuentaInicial={consulta.cuenta_id}
                    onGuardado={resultados.recargar}
                    onCerrar={() => setModal(null)}
                  />
                )}
                {modal !== null && modal !== "nueva" && modal !== "importar" && (
                  <FormularioTransaccion
                    key={modal.id}
                    inicial={modal}
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
