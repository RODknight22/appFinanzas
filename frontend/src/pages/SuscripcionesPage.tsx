import { CalendarCheck, Plus, Repeat } from "lucide-react";
import { useState } from "react";

import { categoriasApi, cuentasApi, suscripcionesApi } from "../api/recursos";
import { FormularioPagoSuscripcion } from "../components/formularios/FormularioPagoSuscripcion";
import { FormularioSuscripcion, PERIODICIDADES } from "../components/formularios/FormularioSuscripcion";
import { AccionesFila } from "../components/ui/AccionesFila";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido, Vacio } from "../components/ui/Estados";
import { Modal } from "../components/ui/Modal";
import { Tarjeta } from "../components/ui/Tarjeta";
import { useConfiguracion } from "../hooks/useConfiguracion";
import { confirmarYEliminar } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import type { Periodicidad, Suscripcion } from "../types";
import { diasHasta, formatearDinero, formatearFecha, textoVencimiento } from "../utils/formato";

/** Cuántas veces se cobra al mes, en promedio, cada periodicidad. */
const COBROS_POR_MES: Record<Periodicidad, number> = {
  semanal: 52 / 12,
  mensual: 1,
  anual: 1 / 12,
};

/** Tres modales posibles; el tipo de unión deja claro cuál está abierto. */
type EstadoModal =
  | null
  | { modo: "nueva" }
  | { modo: "editar"; suscripcion: Suscripcion }
  | { modo: "pagar"; suscripcion: Suscripcion };

const TITULOS = { nueva: "Nueva suscripción", editar: "Editar suscripción", pagar: "Registrar pago" };

export function SuscripcionesPage() {
  const { convertir } = useConfiguracion();
  const [modal, setModal] = useState<EstadoModal>(null);
  const estado = useDatos(
    () => Promise.all([suscripcionesApi.listar(), cuentasApi.listar(), categoriasApi.listar({ tipo: "gasto" })]),
    [],
  );

  function alGuardar() {
    setModal(null);
    estado.recargar();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Suscripciones"
        descripcion="Pagos recurrentes y su próxima fecha de cobro"
        acciones={<Boton onClick={() => setModal({ modo: "nueva" })}><Plus size={16} /> Nueva</Boton>}
      />

      <Contenido {...estado} onReintentar={estado.recargar}>
        {([suscripciones, cuentas, categoriasGasto]) => {
          // Cada suscripción se convierte a la moneda principal (tasa de hoy) antes de sumar.
          const costeMensual = suscripciones.reduce(
            (total, s) => total + (convertir(Number(s.monto), s.moneda) ?? 0) * COBROS_POR_MES[s.periodicidad],
            0,
          );

          return (
            <>
              {suscripciones.length > 0 && (
                <p className="mb-4 text-sm text-tenue">
                  Coste mensual estimado:{" "}
                  <strong className="text-texto tabular-nums">{formatearDinero(costeMensual)}</strong>
                  {" · "}al año: <strong className="text-texto tabular-nums">{formatearDinero(costeMensual * 12)}</strong>
                </p>
              )}

              <Tarjeta>
                {suscripciones.length === 0 ? (
                  <Vacio
                    mensaje="No tienes suscripciones registradas"
                    accion={<Boton variante="secundario" onClick={() => setModal({ modo: "nueva" })}>Añadir la primera</Boton>}
                  />
                ) : (
                  <ul className="divide-y divide-linea">
                    {suscripciones.map((suscripcion) => {
                      const dias = diasHasta(suscripcion.fecha_proximo_pago);
                      // Rojo si está atrasada, ámbar si vence en una semana.
                      const colorFecha = dias < 0 ? "text-rose-600" : dias <= 7 ? "text-amber-600" : "text-tenue";
                      return (
                        <li key={suscripcion.id} className="flex flex-wrap items-center gap-3 py-3">
                          <span className="rounded-lg bg-superficie-2 p-2.5 text-tenue">
                            <Repeat size={18} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{suscripcion.nombre}</p>
                            <p className="text-xs">
                              <span className="text-tenue">{PERIODICIDADES[suscripcion.periodicidad]} · </span>
                              <span className={colorFecha}>
                                {textoVencimiento(suscripcion.fecha_proximo_pago)} ({formatearFecha(suscripcion.fecha_proximo_pago)})
                              </span>
                            </p>
                          </div>
                          <span className="font-semibold tabular-nums">{formatearDinero(suscripcion.monto, suscripcion.moneda)}</span>
                          <Boton variante="secundario" className="px-2.5 py-1.5 text-xs" onClick={() => setModal({ modo: "pagar", suscripcion })}>
                            <CalendarCheck size={14} /> Pagado
                          </Boton>
                          <AccionesFila
                            onEditar={() => setModal({ modo: "editar", suscripcion })}
                            onEliminar={() =>
                              confirmarYEliminar(`¿Eliminar "${suscripcion.nombre}"? Los pagos ya registrados se conservan.`, () => suscripcionesApi.eliminar(suscripcion.id), estado.recargar)
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Tarjeta>

              <Modal titulo={modal ? TITULOS[modal.modo] : ""} abierto={modal !== null} onCerrar={() => setModal(null)}>
                {modal?.modo === "nueva" && <FormularioSuscripcion onGuardado={alGuardar} onCancelar={() => setModal(null)} />}
                {modal?.modo === "editar" && (
                  <FormularioSuscripcion key={modal.suscripcion.id} inicial={modal.suscripcion} onGuardado={alGuardar} onCancelar={() => setModal(null)} />
                )}
                {modal?.modo === "pagar" && (
                  <FormularioPagoSuscripcion
                    key={modal.suscripcion.id}
                    suscripcion={modal.suscripcion}
                    cuentas={cuentas}
                    categoriasGasto={categoriasGasto}
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
