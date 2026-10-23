import { Sparkles } from "lucide-react";
import { useState } from "react";

import { cuentasApi } from "../../api/recursos";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useDatos } from "../../hooks/useDatos";
import { avisarError } from "../ajustes/avisarError";
import { FormularioCuenta } from "../formularios/FormularioCuenta";
import { Boton } from "../ui/Boton";
import { Campo } from "../ui/Campo";
import { Modal } from "../ui/Modal";
import { SelectMoneda } from "../ui/SelectMoneda";
import { PasoSueldo } from "./PasoSueldo";
import { RecorridoGlobos } from "./RecorridoGlobos";

const PASOS = ["Hola", "Moneda", "Cuenta", "Sueldo"] as const;

/**
 * Asistente de la primera vez: moneda principal, primera cuenta, sueldo (opcional) y,
 * al cerrar la ventana, un recorrido con globos por el menú. Cerrarlo o saltarlo cuenta
 * como visto (se puede repetir desde Ajustes).
 */
export function AsistenteBienvenida() {
  const { configuracion, moneda, actualizarConfiguracion } = useConfiguracion();
  const [paso, setPaso] = useState(0);
  const [recorrido, setRecorrido] = useState(false);
  const [monedaElegida, setMonedaElegida] = useState(moneda);
  const cuentas = useDatos(() => cuentasApi.listar(), []);
  const nombre = configuracion.nombre;

  function terminar() {
    actualizarConfiguracion({ tutorial_visto: true }).catch(avisarError);
  }

  async function guardarMoneda() {
    try {
      if (monedaElegida !== moneda) await actualizarConfiguracion({ moneda: monedaElegida });
      setPaso(2);
    } catch (e) {
      avisarError(e);
    }
  }

  const siguiente = () => setPaso((p) => p + 1);
  const cuentasExistentes = cuentas.datos?.length ?? 0;

  if (recorrido) return <RecorridoGlobos onTerminar={terminar} />;

  return (
    <Modal titulo="Primeros pasos" abierto onCerrar={terminar}>
      <ol className="mb-5 flex gap-1.5" aria-label={`Paso ${paso + 1} de ${PASOS.length}`}>
        {PASOS.map((nombrePaso, i) => (
          <li key={nombrePaso} className={`h-1.5 flex-1 rounded-full ${i <= paso ? "bg-acento-500" : "bg-superficie-2"}`}>
            <span className="sr-only">{nombrePaso}</span>
          </li>
        ))}
      </ol>

      {paso === 0 && (
        <div className="space-y-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-acento-600 text-white">
            <Sparkles size={24} />
          </span>
          <h3 className="text-xl font-bold">¡Hola{nombre ? `, ${nombre}` : ""}! Te damos la bienvenida</h3>
          <p className="text-sm text-suave">
            En un minuto dejamos lista la app: eliges tu moneda, creas tu primera cuenta, apuntas tu sueldo si quieres y te enseñamos dónde está cada cosa.
          </p>
          <div className="flex justify-between gap-2 pt-2">
            <Boton variante="fantasma" onClick={terminar}>Saltar</Boton>
            <Boton onClick={siguiente}>Empezar</Boton>
          </div>
        </div>
      )}

      {paso === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">¿En qué moneda haces tus cuentas?</h3>
          <Campo
            etiqueta="Moneda principal"
            ayuda="En ella se suman los totales, el panel y los presupuestos. Cada cuenta puede ir en su propia divisa: si cobras en pesos y gastas en euros, elige la que uses para pensar en tu dinero."
          >
            <SelectMoneda valor={monedaElegida} onCambiar={setMonedaElegida} />
          </Campo>
          <div className="flex justify-between gap-2 pt-2">
            <Boton variante="fantasma" onClick={() => setPaso(0)}>Atrás</Boton>
            <Boton onClick={guardarMoneda}>Siguiente</Boton>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Tu primera cuenta</h3>
          {cuentasExistentes > 0 ? (
            <>
              <p className="text-sm text-suave">
                Ya tienes {cuentasExistentes} {cuentasExistentes === 1 ? "cuenta" : "cuentas"}. Puedes añadir más cuando quieras desde Cuentas.
              </p>
              <div className="flex justify-between gap-2 pt-2">
                <Boton variante="fantasma" onClick={() => setPaso(1)}>Atrás</Boton>
                <Boton onClick={siguiente}>Siguiente</Boton>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-suave">
                Empieza por la que más uses: tu banco, una tarjeta o el efectivo. El saldo inicial es lo que tienes hoy.
              </p>
              {/* Cancelar = "ahora no": se pasa al recorrido sin crearla. */}
              <FormularioCuenta
                onGuardado={() => {
                  cuentas.recargar();
                  siguiente();
                }}
                onCancelar={siguiente}
              />
            </>
          )}
        </div>
      )}

      {paso === 3 && (
        <PasoSueldo cuentas={cuentas.datos ?? []} cargandoCuentas={cuentas.cargando} onAtras={() => setPaso(2)} onSiguiente={() => setRecorrido(true)} />
      )}
    </Modal>
  );
}
