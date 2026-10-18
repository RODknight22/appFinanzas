import { Plus } from "lucide-react";
import { useState } from "react";

import { dashboardApi } from "../api/dashboard";
import { cuentasApi } from "../api/recursos";
import { FilaCuenta } from "../components/cuentas/FilaCuenta";
import { FormularioCuenta } from "../components/formularios/FormularioCuenta";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido, Vacio } from "../components/ui/Estados";
import { Modal } from "../components/ui/Modal";
import { Tarjeta } from "../components/ui/Tarjeta";
import { confirmarYEliminar } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import type { Cuenta } from "../types";
import { formatearDinero, mesActual } from "../utils/formato";

/**
 * Estado del modal: cerrado (null), creando ("nueva") o editando una cuenta.
 * Un solo estado evita combinaciones imposibles como "abierto pero sin modo".
 */
type EstadoModal = null | "nueva" | Cuenta;

export function CuentasPage() {
  const [modal, setModal] = useState<EstadoModal>(null);
  // Las cuentas vienen con su saldo actual calculado en el resumen del dashboard.
  const estado = useDatos(() => Promise.all([cuentasApi.listar(), dashboardApi.resumen(mesActual())]), []);

  function alGuardar() {
    setModal(null);
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

  return (
    <>
      <EncabezadoPagina
        titulo="Cuentas"
        descripcion="Efectivo, débito, tarjetas de crédito y cuentas con rendimientos"
        acciones={<Boton onClick={() => setModal("nueva")}><Plus size={16} /> Nueva cuenta</Boton>}
      />

      <Tarjeta>
        <Contenido {...estado} onReintentar={estado.recargar}>
          {([cuentas, resumen]) => {
            if (cuentas.length === 0) {
              return <Vacio mensaje="Crea tu primera cuenta para empezar a registrar movimientos" />;
            }
            const saldos = new Map(resumen.cuentas.map((c) => [c.cuenta_id, Number(c.saldo)]));
            return (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {cuentas.map((cuenta) => (
                  <FilaCuenta
                    key={cuenta.id}
                    cuenta={cuenta}
                    saldo={saldos.get(cuenta.id) ?? Number(cuenta.balance_inicial)}
                    onEditar={() => setModal(cuenta)}
                    onEliminar={() =>
                      confirmarYEliminar(`¿Eliminar la cuenta "${cuenta.nombre}"?`, () => cuentasApi.eliminar(cuenta.id), estado.recargar)
                    }
                    onRegistrarRendimientos={() => registrarRendimientos(cuenta)}
                  />
                ))}
              </ul>
            );
          }}
        </Contenido>
      </Tarjeta>

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
    </>
  );
}
