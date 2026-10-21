import { Plus } from "lucide-react";
import { useState } from "react";

import { dashboardApi } from "../api/dashboard";
import { categoriasApi, presupuestosApi } from "../api/recursos";
import { BarraPresupuesto } from "../components/dashboard/BarraPresupuesto";
import { FormularioPresupuesto } from "../components/formularios/FormularioPresupuesto";
import { AccionesFila } from "../components/ui/AccionesFila";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido, Vacio } from "../components/ui/Estados";
import { Modal } from "../components/ui/Modal";
import { SelectorMes } from "../components/ui/SelectorMes";
import { Tarjeta } from "../components/ui/Tarjeta";
import { confirmarYEliminar } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import type { Presupuesto, ProgresoPresupuesto } from "../types";
import { formatearDinero, formatearMes, mesActual } from "../utils/formato";

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
    () => Promise.all([dashboardApi.presupuestos(mes), categoriasApi.listar({ tipo: "gasto" })]),
    [mes],
  );

  function alGuardar() {
    setModal(null);
    estado.recargar();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Presupuestos"
        descripcion="Pon un límite mensual a cada categoría de gasto"
        acciones={
          <>
            <SelectorMes mes={mes} onCambiar={setMes} />
            <Boton onClick={() => setModal("nuevo")}><Plus size={16} /> Nuevo</Boton>
          </>
        }
      />

      <Contenido {...estado} onReintentar={estado.recargar}>
        {([progresos, categoriasGasto]) => {
          // En la principal: los presupuestos pueden estar en monedas distintas.
          const totalLimite = progresos.reduce((suma, p) => suma + Number(p.limite_principal), 0);
          const totalGastado = progresos.reduce((suma, p) => suma + Number(p.gastado_principal), 0);

          return (
            <>
              {progresos.length > 0 && (
                <p className="mb-4 text-sm text-tenue">
                  Total: <strong className="text-texto tabular-nums">{formatearDinero(totalGastado)}</strong> gastado de{" "}
                  <strong className="text-texto tabular-nums">{formatearDinero(totalLimite)}</strong> presupuestado
                </p>
              )}

              <Tarjeta>
                {progresos.length === 0 ? (
                  <Vacio
                    mensaje={`No hay presupuestos para ${formatearMes(mes)}`}
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
                          onEditar={() => setModal(aPresupuesto(progreso))}
                          onEliminar={() =>
                            confirmarYEliminar(`¿Eliminar el presupuesto de "${progreso.nombre}"?`, () => presupuestosApi.eliminar(progreso.presupuesto_id), estado.recargar)
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
            </>
          );
        }}
      </Contenido>
    </>
  );
}
