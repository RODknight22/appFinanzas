import { useState } from "react";

import { avisarError } from "../components/ajustes/avisarError";
import { confirmar } from "../components/ui/tablonAvisos";

/**
 * Gestiona el envío de un formulario: desactiva el botón mientras se guarda
 * y guarda el mensaje de error de la API para mostrarlo.
 */
export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Ejecuta `accion` y devuelve true si terminó sin errores. */
  async function ejecutar(accion: () => Promise<unknown>): Promise<boolean> {
    setEnviando(true);
    setError(null);
    try {
      await accion();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setEnviando(false);
    }
  }

  return { enviando, error, ejecutar };
}

/** Pide confirmación, borra y avisa si el backend lo impide (p. ej. un 409). */
export async function confirmarYEliminar(
  mensaje: string,
  eliminar: () => Promise<void>,
  alTerminar: () => void,
): Promise<void> {
  if (!(await confirmar(mensaje, { textoAceptar: "Eliminar", peligro: true }))) return;
  try {
    await eliminar();
    alTerminar();
  } catch (e) {
    avisarError(e);
  }
}
