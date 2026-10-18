import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { configuracionApi, tasasApi } from "../api/configuracion";
import { MONEDA_POR_DEFECTO, MONEDAS } from "../config";
import type { Configuracion, Moneda, Tasa } from "../types";
import { convertir } from "../utils/divisas";
import { configurarMoneda } from "../utils/formato";

interface ContextoConfiguracion {
  /** Moneda principal: la de totales, gráficos y presupuestos. */
  moneda: Moneda;
  /** Monedas que se ofrecen en los formularios. */
  monedasActivas: Moneda[];
  /** Tasas vigentes, para mostrar conversiones aproximadas. */
  tasas: Tasa[];
  actualizarConfiguracion: (cambios: Partial<Configuracion>) => Promise<void>;
  recargarTasas: () => Promise<void>;
  /** Convierte con las tasas vigentes; undefined si falta alguna tasa. */
  convertir: (monto: number, de: Moneda, a?: Moneda) => number | undefined;
}

/**
 * Un "contexto" comparte datos con todos los componentes sin pasarlos como
 * props de padre a hijo. Aquí compartimos la configuración y las tasas.
 */
const Contexto = createContext<ContextoConfiguracion | null>(null);

const CONFIGURACION_INICIAL: Configuracion = {
  moneda: MONEDA_POR_DEFECTO,
  monedas_activas: Object.keys(MONEDAS) as Moneda[],
};

export function ConfiguracionProvider({ children }: { children: ReactNode }) {
  const [configuracion, setConfiguracion] = useState<Configuracion>(CONFIGURACION_INICIAL);
  const [tasas, setTasas] = useState<Tasa[]>([]);
  const [lista, setLista] = useState(false);

  function aplicar(nueva: Configuracion) {
    configurarMoneda(nueva.moneda);
    // Cambiar el estado vuelve a renderizar la app con el nuevo formato.
    setConfiguracion(nueva);
  }

  const recargarTasas = useCallback(async () => {
    setTasas(await tasasApi.listar());
  }, []);

  useEffect(() => {
    // Si el backend no responde, seguimos con valores por defecto;
    // cada página mostrará su propio error al intentar cargar datos.
    Promise.allSettled([configuracionApi.obtener().then(aplicar), recargarTasas()]).finally(() =>
      setLista(true),
    );
  }, [recargarTasas]);

  /**
   * Actualización "optimista": se aplica al instante en pantalla (la casilla
   * responde al clic sin esperar al servidor) y se deshace si el backend falla.
   */
  async function actualizarConfiguracion(cambios: Partial<Configuracion>) {
    const anterior = configuracion;
    aplicar({ ...configuracion, ...cambios });
    try {
      aplicar(await configuracionApi.actualizar(cambios));
    } catch (e) {
      aplicar(anterior);
      throw e;
    }
  }

  // No pintamos nada hasta conocer la moneda, para no mostrar importes
  // con un formato y cambiarlos un instante después.
  if (!lista) return null;

  const valor: ContextoConfiguracion = {
    moneda: configuracion.moneda,
    monedasActivas: configuracion.monedas_activas,
    tasas,
    actualizarConfiguracion,
    recargarTasas,
    convertir: (monto, de, a = configuracion.moneda) => convertir(monto, de, a, tasas),
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useConfiguracion(): ContextoConfiguracion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useConfiguracion debe usarse dentro de <ConfiguracionProvider>");
  return contexto;
}
