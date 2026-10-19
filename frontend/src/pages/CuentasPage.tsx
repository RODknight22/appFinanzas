import { ArrowRightLeft, Plus } from "lucide-react";
import { useState } from "react";

import { dashboardApi } from "../api/dashboard";
import { cuentasApi, transferenciasApi } from "../api/recursos";
import { FilaCuenta } from "../components/cuentas/FilaCuenta";
import { ListaTransferencias } from "../components/cuentas/ListaTransferencias";
import { FormularioCuenta } from "../components/formularios/FormularioCuenta";
import { FormularioTransferencia, type PagoTarjeta } from "../components/formularios/FormularioTransferencia";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido, Vacio } from "../components/ui/Estados";
import { Modal } from "../components/ui/Modal";
import { Tarjeta } from "../components/ui/Tarjeta";
import { confirmarYEliminar } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import type { Cuenta, Transferencia } from "../types";
import { formatearDinero, mesActual } from "../utils/formato";

/**
 * Estado del modal: cerrado (null), creando ("nueva") o editando una cuenta.
 * Un solo estado evita combinaciones imposibles como "abierto pero sin modo".
 */
type EstadoModal = null | "nueva" | Cuenta;
/** Transferencia: cerrado, nueva (opcionalmente como pago de tarjeta) o editando una. */
type EstadoTransferencia = null | { inicial?: Transferencia; pago?: PagoTarjeta };

export function CuentasPage() {
  const [modal, setModal] = useState<EstadoModal>(null);
  const [transferencia, setTransferencia] = useState<EstadoTransferencia>(null);
  // Las cuentas vienen con su saldo actual calculado en el resumen del dashboard.
  const estado = useDatos(
    () => Promise.all([cuentasApi.listar(), dashboardApi.resumen(mesActual()), transferenciasApi.listar({ limit: 20 })]),
    [],
  );

  function alGuardar() {
    setModal(null);
    setTransferencia(null);
    estado.recargar();
  }

  async function registrarRendimientos(cuenta: Cuenta) {
    try {
      const ingreso = await cuentasApi.registrarRendimientos(cuenta.id);
      window.alert(`Se registraron ${formatearDinero(ingreso.monto, ingreso.moneda)} de rendimientos en "${cuenta.nombre}".`);
      estado.recargar();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }

  const cuentas = estado.datos?.[0] ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo="Cuentas"
        descripcion="Efectivo, débito, tarjetas de crédito y cuentas con rendimientos"
        acciones={
          <>
            {cuentas.length >= 2 && (
              <Boton variante="secundario" onClick={() => setTransferencia({})}>
                <ArrowRightLeft size={16} /> Transferir
              </Boton>
            )}
            <Boton onClick={() => setModal("nueva")}><Plus size={16} /> Nueva cuenta</Boton>
          </>
        }
      />

      <Contenido {...estado} onReintentar={estado.recargar}>
        {([cuentas, resumen, transferencias]) => {
          const saldos = new Map(resumen.cuentas.map((c) => [c.cuenta_id, Number(c.saldo)]));
          return (
            <div className="space-y-6">
              <Tarjeta>
                {cuentas.length === 0 ? (
                  <Vacio mensaje="Crea tu primera cuenta para empezar a registrar movimientos" />
                ) : (
                  <ul className="divide-y divide-linea">
                    {cuentas.map((cuenta) => {
                      const saldo = saldos.get(cuenta.id) ?? Number(cuenta.balance_inicial);
                      return (
                        <FilaCuenta
                          key={cuenta.id}
                          cuenta={cuenta}
                          saldo={saldo}
                          onEditar={() => setModal(cuenta)}
                          onEliminar={() =>
                            confirmarYEliminar(`¿Eliminar la cuenta "${cuenta.nombre}"?`, () => cuentasApi.eliminar(cuenta.id), estado.recargar)
                          }
                          onRegistrarRendimientos={() => registrarRendimientos(cuenta)}
                          // En una tarjeta, el saldo negativo es la deuda.
                          onPagar={() => setTransferencia({ pago: { cuentaId: cuenta.id, monto: -saldo } })}
                        />
                      );
                    })}
                  </ul>
                )}
              </Tarjeta>

              {cuentas.length >= 2 && (
                <Tarjeta titulo="Últimas transferencias">
                  <ListaTransferencias
                    transferencias={transferencias}
                    cuentas={cuentas}
                    onEditar={(t) => setTransferencia({ inicial: t })}
                    onEliminar={(t) =>
                      confirmarYEliminar(
                        `¿Eliminar esta transferencia${t.comision ? " y su comisión" : ""}?`,
                        () => transferenciasApi.eliminar(t.id),
                        estado.recargar,
                      )
                    }
                  />
                </Tarjeta>
              )}
            </div>
          );
        }}
      </Contenido>

      <Modal titulo={modal === "nueva" ? "Nueva cuenta" : "Editar cuenta"} abierto={modal !== null} onCerrar={() => setModal(null)}>
        {modal !== null && (
          <FormularioCuenta
            // `key` fuerza un formulario nuevo al cambiar de cuenta, reiniciando sus campos.
            key={modal === "nueva" ? "nueva" : modal.id}
            inicial={modal === "nueva" ? undefined : modal}
            onGuardado={alGuardar}
            onCancelar={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal
        titulo={transferencia?.inicial ? "Editar transferencia" : transferencia?.pago ? "Pagar tarjeta" : "Nueva transferencia"}
        abierto={transferencia !== null}
        onCerrar={() => setTransferencia(null)}
      >
        {transferencia !== null && (
          <FormularioTransferencia
            key={transferencia.inicial?.id ?? `pago-${transferencia.pago?.cuentaId ?? "nueva"}`}
            inicial={transferencia.inicial}
            pago={transferencia.pago}
            cuentas={cuentas}
            onGuardado={alGuardar}
            onCancelar={() => setTransferencia(null)}
          />
        )}
      </Modal>
    </>
  );
}
