import { Plus } from "lucide-react";
import { useState } from "react";

import { dashboardApi } from "../api/dashboard";
import { cuentasApi } from "../api/recursos";
import { FormularioCuenta, TIPOS_CUENTA } from "../components/formularios/FormularioCuenta";
import { AccionesFila } from "../components/ui/AccionesFila";
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

  return (
    <>
      <EncabezadoPagina
        titulo="Cuentas"
        descripcion="Dónde está tu dinero: bancos, efectivo, tarjetas…"
        acciones={<Boton onClick={() => setModal("nueva")}><Plus size={16} /> Nueva cuenta</Boton>}
      />

      <Tarjeta>
        <Contenido {...estado} onReintentar={estado.recargar}>
          {([cuentas, resumen]) => {
            if (cuentas.length === 0) {
              return <Vacio mensaje="Crea tu primera cuenta para empezar a registrar movimientos" />;
            }
            const saldos = new Map(resumen.cuentas.map((c) => [c.cuenta_id, c.saldo]));
            return (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {cuentas.map((cuenta) => (
                  <li key={cuenta.id} className="flex items-center gap-4 py-3">
                    <div className="flex-1">
                      <p className="font-medium">{cuenta.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {TIPOS_CUENTA[cuenta.tipo]} · Balance inicial {formatearDinero(cuenta.balance_inicial)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Saldo actual</p>
                      <p className="font-semibold tabular-nums">{formatearDinero(saldos.get(cuenta.id) ?? cuenta.balance_inicial)}</p>
                    </div>
                    <AccionesFila
                      onEditar={() => setModal(cuenta)}
                      onEliminar={() =>
                        confirmarYEliminar(`¿Eliminar la cuenta "${cuenta.nombre}"?`, () => cuentasApi.eliminar(cuenta.id), estado.recargar)
                      }
                    />
                  </li>
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
