import { HandCoins, Plus } from "lucide-react";
import { useState } from "react";

import { categoriasApi, cuentasApi, ingresosApi } from "../api/recursos";
import { FormularioCobro } from "../components/formularios/FormularioCobro";
import { FormularioIngreso } from "../components/formularios/FormularioIngreso";
import { AccionesFila } from "../components/ui/AccionesFila";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido, Vacio } from "../components/ui/Estados";
import { IconoCategoria } from "../components/ui/IconoCategoria";
import { Modal } from "../components/ui/Modal";
import { Tarjeta } from "../components/ui/Tarjeta";
import { TotalConvertido } from "../components/ui/TotalConvertido";
import { useConfiguracion } from "../hooks/useConfiguracion";
import { confirmarYEliminar } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import type { IngresoRecurrente } from "../types";
import { sumarConvertidos } from "../utils/divisas";
import { diasHasta, formatearDinero, formatearFecha, textoVencimiento } from "../utils/formato";
import { cobrosPorMes, describirPeriodicidad } from "../utils/periodicidad";

type EstadoModal =
  | null
  | { modo: "nuevo" }
  | { modo: "editar"; ingreso: IngresoRecurrente }
  | { modo: "cobrar"; ingreso: IngresoRecurrente };

const TITULOS = { nuevo: "Nuevo ingreso fijo", editar: "Editar ingreso fijo", cobrar: "Registrar cobro" };

export function IngresosPage() {
  const { convertir } = useConfiguracion();
  const [modal, setModal] = useState<EstadoModal>(null);
  const estado = useDatos(
    () => Promise.all([ingresosApi.listar(), cuentasApi.listar(), categoriasApi.listar({ tipo: "ingreso" })]),
    [],
    "ingresos",
  );

  function alGuardar() {
    setModal(null);
    estado.recargar();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Ingresos fijos"
        consejo="Elige los días de la quincena, repite cada N semanas o meses, y adelanta el cobro al viernes si cae en fin de semana."
        descripcion="Nómina, rentas y otros ingresos que llegan cada cierto tiempo"
        // Sin ingresos, el botón de crear ya está en el aviso de lista vacía.
        acciones={estado.datos?.[0].length !== 0 && <Boton onClick={() => setModal({ modo: "nuevo" })}><Plus size={16} /> Nuevo</Boton>}
      />

      <Contenido {...estado} onReintentar={estado.recargar}>
        {([ingresos, cuentas, categoriasIngreso]) => {
          const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
          const categoriaPorId = new Map(categoriasIngreso.map((c) => [c.id, c]));
          // Cada ingreso se convierte a la moneda principal (tasa de hoy) antes de sumar.
          const mensual = sumarConvertidos(
            ingresos.map((i) => ({ monto: Number(i.monto) * cobrosPorMes(i), moneda: i.moneda })),
            convertir,
          );

          return (
            <>
              {ingresos.length > 0 && (
                <p className="mb-4 text-sm text-tenue">
                  Ingreso mensual estimado:{" "}
                  <strong className="text-texto tabular-nums"><TotalConvertido suma={mensual} /></strong>
                  {" · "}al año: <strong className="text-texto tabular-nums"><TotalConvertido suma={mensual} factor={12} /></strong>
                </p>
              )}

              <Tarjeta>
                {ingresos.length === 0 ? (
                  <Vacio
                    mensaje="No tienes ingresos fijos registrados"
                    accion={<Boton variante="secundario" onClick={() => setModal({ modo: "nuevo" })}>Añadir el primero</Boton>}
                  />
                ) : (
                  <ul className="divide-y divide-linea">
                    {ingresos.map((ingreso) => {
                      const dias = diasHasta(ingreso.fecha_proximo_cobro);
                      // Ámbar si ya debería haber llegado; acento si llega esta semana.
                      const colorFecha = dias < 0 ? "text-amber-600" : dias <= 7 ? "text-acento-600" : "text-tenue";
                      const categoria = categoriaPorId.get(ingreso.categoria_id);
                      return (
                        <li key={ingreso.id} className="flex flex-wrap items-center gap-3 py-3">
                          <IconoCategoria icono={categoria?.icono ?? "banknote"} color={categoria?.color ?? "#10b981"} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{ingreso.nombre}</p>
                            <p className="text-xs">
                              <span className="text-tenue">
                                {describirPeriodicidad(ingreso)} · {cuentaPorId.get(ingreso.cuenta_id)?.nombre} ·{" "}
                              </span>
                              <span className={colorFecha}>
                                {textoVencimiento(ingreso.fecha_proximo_cobro)} ({formatearFecha(ingreso.fecha_proximo_cobro)})
                              </span>
                            </p>
                          </div>
                          <span className="font-semibold tabular-nums text-ingreso">
                            +{formatearDinero(ingreso.monto, ingreso.moneda)}
                          </span>
                          <Boton variante="secundario" className="px-2.5 py-1.5 text-xs" onClick={() => setModal({ modo: "cobrar", ingreso })}>
                            <HandCoins size={14} /> Cobrado
                          </Boton>
                          <AccionesFila
                            nombre={ingreso.nombre}
                            onEditar={() => setModal({ modo: "editar", ingreso })}
                            onEliminar={() =>
                              confirmarYEliminar(`¿Eliminar «${ingreso.nombre}»? Los cobros ya registrados se conservan.`, () => ingresosApi.eliminar(ingreso.id), estado.recargar)
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Tarjeta>

              <Modal titulo={modal ? TITULOS[modal.modo] : ""} abierto={modal !== null} onCerrar={() => setModal(null)}>
                {modal?.modo === "nuevo" && (
                  <FormularioIngreso cuentas={cuentas} categoriasIngreso={categoriasIngreso} onGuardado={alGuardar} onCancelar={() => setModal(null)} />
                )}
                {modal?.modo === "editar" && (
                  <FormularioIngreso
                    key={modal.ingreso.id}
                    inicial={modal.ingreso}
                    cuentas={cuentas}
                    categoriasIngreso={categoriasIngreso}
                    onGuardado={alGuardar}
                    onCancelar={() => setModal(null)}
                  />
                )}
                {modal?.modo === "cobrar" && (
                  <FormularioCobro key={modal.ingreso.id} ingreso={modal.ingreso} cuentas={cuentas} onGuardado={alGuardar} onCancelar={() => setModal(null)} />
                )}
              </Modal>
            </>
          );
        }}
      </Contenido>
    </>
  );
}
