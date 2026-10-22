import { useState } from "react";

const CLAVE = "cuentas-plegadas";

function leerPlegadas(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE) ?? "[]"));
  } catch {
    return new Set(); // navegación privada o dato corrupto: todas desplegadas
  }
}

/**
 * Qué cuentas madre tienen sus subcuentas plegadas.
 *
 * Por defecto todas se ven desplegadas; este navegador recuerda las que plegaste,
 * así que la lista sigue igual al volver a la página.
 */
export function useCuentasPlegadas() {
  const [plegadas, setPlegadas] = useState(leerPlegadas);

  function alternar(cuentaId: number) {
    const nuevas = new Set(plegadas);
    if (nuevas.has(cuentaId)) nuevas.delete(cuentaId);
    else nuevas.add(cuentaId);
    setPlegadas(nuevas);
    try {
      localStorage.setItem(CLAVE, JSON.stringify([...nuevas]));
    } catch {
      // Sin almacenamiento, el plegado solo dura hasta recargar.
    }
  }

  return { estaPlegada: (cuentaId: number) => plegadas.has(cuentaId), alternar };
}
