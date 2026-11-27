import { fijosApi } from "../../api/recursos";
import type { FijoCandidato, Transaccion } from "../../types";
import { formatearFecha } from "../../utils/formato";
import { avisarError } from "../ajustes/avisarError";
import { avisar, confirmar } from "../ui/tablonAvisos";

/** "el cobro de «Nómina»" o "el pago de «Alquiler»". */
export function textoFijo(fijo: Pick<FijoCandidato, "tipo" | "nombre">): string {
  return `el ${fijo.tipo === "ingreso" ? "cobro" : "pago"} de «${fijo.nombre}»`;
}

/**
 * Tras anotar un ingreso o gasto a mano: si se parece a un fijo que aún se espera (la nómina,
 * el alquiler), pregunta si es ese. Si lo es, la fecha del fijo avanza y el Plan del mes no lo
 * cuenta dos veces (lo anotado + lo previsto). Si no hay parecido, no molesta.
 */
export async function preguntarSiEsFijo(transaccion: Transaccion): Promise<void> {
  // Una comisión de transferencia no es un cobro ni un pago fijo.
  if (transaccion.transferencia_id !== null) return;
  let candidatos: FijoCandidato[];
  try {
    candidatos = await fijosApi.candidatos({
      tipo: transaccion.tipo,
      monto: transaccion.monto,
      cuenta_id: transaccion.cuenta_id,
      fecha: transaccion.fecha,
      moneda: transaccion.moneda,
    });
  } catch {
    return; // es solo una ayuda: si falla, lo anotado ya está guardado
  }
  const fijo = candidatos[0];
  if (!fijo) return;
  const esFijo = await confirmar(
    `¿Es ${textoFijo(fijo)} del ${formatearFecha(fijo.fecha_prevista)}?\n\nAsí no se cuenta dos veces en el Plan del mes.`,
    { textoAceptar: "Sí", textoCancelar: "No" },
  );
  if (!esFijo) return;
  try {
    await fijosApi.reconocer(fijo, transaccion.id);
    avisar(`Listo: ${textoFijo(fijo)} ya cuenta como ${fijo.tipo === "ingreso" ? "cobrado" : "pagado"}`);
  } catch (e) {
    avisarError(e);
  }
}
