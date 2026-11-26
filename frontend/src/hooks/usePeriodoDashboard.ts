import { useState } from "react";

import { esPeriodo, type Periodo } from "../utils/periodo";

const CLAVE = "dashboard-periodo";

function leerPeriodo(): Periodo {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return esPeriodo(guardado) ? guardado : "mes";
  } catch {
    return "mes"; // navegación privada: el de siempre
  }
}

/**
 * El periodo del dashboard. Lo recuerda este navegador (como el plegado de cuentas):
 * es una forma de mirar, no un dato que haya que llevar a otros equipos.
 */
export function usePeriodoDashboard() {
  const [periodo, setPeriodo] = useState(leerPeriodo);

  function cambiar(nuevo: Periodo) {
    setPeriodo(nuevo);
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      // Sin almacenamiento, la elección solo dura hasta recargar.
    }
  }

  return [periodo, cambiar] as const;
}
