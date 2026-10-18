import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { configuracionApi } from "../api/configuracion";
import { MONEDA_POR_DEFECTO } from "../config";
import type { Moneda } from "../types";
import { configurarMoneda } from "../utils/formato";

interface ContextoConfiguracion {
  moneda: Moneda;
  cambiarMoneda: (moneda: Moneda) => Promise<void>;
}

/**
 * Un "contexto" comparte datos con todos los componentes sin pasarlos como
 * props de padre a hijo. Aquí compartimos la moneda elegida.
 */
const Contexto = createContext<ContextoConfiguracion | null>(null);

export function ConfiguracionProvider({ children }: { children: ReactNode }) {
  const [moneda, setMoneda] = useState<Moneda>(MONEDA_POR_DEFECTO);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    configuracionApi
      .obtener()
      .then((configuracion) => {
        configurarMoneda(configuracion.moneda);
        setMoneda(configuracion.moneda);
      })
      // Si el backend no responde, seguimos con la moneda por defecto;
      // cada página mostrará su propio error al intentar cargar datos.
      .catch(() => undefined)
      .finally(() => setLista(true));
  }, []);

  async function cambiarMoneda(nueva: Moneda) {
    await configuracionApi.actualizar({ moneda: nueva });
    configurarMoneda(nueva);
    // Cambiar el estado vuelve a renderizar la app con el nuevo formato.
    setMoneda(nueva);
  }

  // No pintamos nada hasta conocer la moneda, para no mostrar importes
  // con un formato y cambiarlos un instante después.
  if (!lista) return null;

  return <Contexto.Provider value={{ moneda, cambiarMoneda }}>{children}</Contexto.Provider>;
}

export function useConfiguracion(): ContextoConfiguracion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useConfiguracion debe usarse dentro de <ConfiguracionProvider>");
  return contexto;
}
