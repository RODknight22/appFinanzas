import { Copy, Plus } from "lucide-react";
import { useState } from "react";

import { dashboardApi } from "../api/dashboard";
import { categoriasApi, presupuestosApi } from "../api/recursos";
import { BarraPresupuesto } from "../components/dashboard/BarraPresupuesto";
import { FormularioPresupuesto } from "../components/formularios/FormularioPresupuesto";
import { AccionesFila } from "../components/ui/AccionesFila";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { ErrorFormulario } from "../components/ui/Campo";
import { Contenido, Vacio } from "../components/ui/Estados";
import { Modal } from "../components/ui/Modal";
import { SelectorMes } from "../components/ui/SelectorMes";
import { Tarjeta } from "../components/ui/Tarjeta";
import { confirmarYEliminar, useEnvio } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import type { Presupuesto, ProgresoPresupuesto } from "../types";
import { formatearDinero, formatearMesEnFrase, mesActual } from "../utils/formato";

type EstadoModal = null | "nuevo" | Presupuesto;

/** El progreso del dashboard trae todo lo necesario para editar el presupuesto. */
function aPresupuesto(progreso: ProgresoPresupuesto): Presupuesto {
  return {
    id: progreso.presupuesto_id,
    categoria_id: progreso.categoria_id,
    monto_limite: progreso.monto_limite,
    mes_anio: progreso.mes_anio,
    moneda: progreso.moneda,
  };
}

export function PresupuestosPage() {
  const [mes, setMes] = useState(mesActual());
  const [modal, setModal] = useState<EstadoModal>(null);
  const estado = useDatos(
    () => Promise.all([dashboardApi.presupuestos(mes), categoriasApi.listar({ tipo: "gasto" }), presupuestosApi.copiables(mes)]),
    [mes],
    "presupuestos",
  );
  const copia = useEnvio();
  const sinPresupuestos = estado.datos?.[0].length === 0;

  async function copiar() {
    if (await copia.ejecutar(() => presupuestosApi.copiar(mes))) estado.recargar();
  }

  function alGuardar() {
    setModal(null);
    estado.recargar();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Presupuestos"
        consejo="Cada presupuesto puede ir en su propia moneda: los gastos en otra divisa se convierten con la tasa del día en que los hiciste."
        descripcion="Pon un límite mensual a cada categoría de gasto"
        acciones={
          <>
            <SelectorMes mes={mes} onCambiar={setMes} />
            {/* Sin presupuestos, el botón de crear ya está en el aviso de lista vacía. */}
            {!sinPresupuestos && <Boton onClick={() => setModal("nuevo")}><Plus size={16} /> Nuevo</Boton>}
          </>
        }
      />

      <Contenido {...estado} onReintentar={estado.recargar}>
        {([progresos, categoriasGasto, copiables]) => {
          // En la principal: los presupuestos pueden estar en monedas distintas.
          const totalLimite = progresos.reduce((suma, p) => suma + Number(p.limite_principal), 0);
          const totalGastado = progresos.reduce((suma, p) => suma + Number(p.gastado_principal), 0);

          return (
            // Al cambiar de mes, mientras llegan los datos nuevos se ven los del mes anterior: atenuados.
            <div aria-busy={estado.cargando} className={`transition-opacity ${estado.cargando ? "pointer-events-none opacity-50" : ""}`}>
              {progresos.length > 0 && (
                <p className="mb-4 text-sm text-tenue">
                  Total: <strong className="text-texto tabular-nums">{formatearDinero(totalGastado)}</strong> gastado de{" "}
                  <strong className="text-texto tabular-nums">{formatearDinero(totalLimite)}</strong> presupuestado
                </p>
              )}

              {/* Repetir el mes: lo normal es que los límites se parezcan de un mes a otro */}
              {copiables.desde && copiables.cantidad > 0 && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-superficie-2 px-4 py-3 text-sm ring-1 ring-linea">
                  <span className="text-suave">
                    {progresos.length === 0 ? "¿Repites los presupuestos de" : "Faltan presupuestos que tenías en"}{" "}
                    <strong className="text-texto">{formatearMesEnFrase(copiables.desde)}</strong>?
                  </span>
                  <Boton variante="secundario" onClick={copiar} disabled={copia.enviando}>
                    <Copy size={16} /> Copiar {copiables.cantidad} {copiables.cantidad === 1 ? "presupuesto" : "presupuestos"}
                  </Boton>
                </div>
              )}
              <ErrorFormulario mensaje={copia.error} />

              <Tarjeta>
                {progresos.length === 0 ? (
                  <Vacio
                    mensaje={`No hay presupuestos para ${formatearMesEnFrase(mes)}`}
                    accion={<Boton variante="secundario" onClick={() => setModal("nuevo")}>Crear presupuesto</Boton>}
                  />
                ) : (
                  <ul className="space-y-6">
                    {progresos.map((progreso) => (
                      <li key={progreso.presupuesto_id} className="flex items-start gap-3">
                        <div className="flex-1">
                          <BarraPresupuesto progreso={progreso} />
                        </div>
                        <AccionesFila
                          nombre={`el presupuesto de ${progreso.nombre}`}
                          onEditar={() => setModal(aPresupuesto(progreso))}
                          onEliminar={() =>
                            confirmarYEliminar(`¿Eliminar el presupuesto de «${progreso.nombre}»?`, () => presupuestosApi.eliminar(progreso.presupuesto_id), estado.recargar)
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>

              <Modal titulo={modal === "nuevo" ? "Nuevo presupuesto" : "Editar presupuesto"} abierto={modal !== null} onCerrar={() => setModal(null)}>
                {modal !== null && (
                  <FormularioPresupuesto
                    key={modal === "nuevo" ? "nuevo" : modal.id}
                    inicial={modal === "nuevo" ? undefined : modal}
                    categoriasGasto={categoriasGasto}
                    mesInicial={mes}
                    onGuardado={alGuardar}
                    onCancelar={() => setModal(null)}
                  />
                )}
              </Modal>
            </div>
          );
        }}
      </Contenido>
    </>
  );
}
