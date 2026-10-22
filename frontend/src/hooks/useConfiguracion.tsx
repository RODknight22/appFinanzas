import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { configuracionApi, tasasApi } from "../api/configuracion";
import { MONEDA_POR_DEFECTO, MONEDAS } from "../config";
import type { ColorAcento, Configuracion, EstiloVisual, Moneda, Tasa } from "../types";
import { convertir } from "../utils/divisas";
import { conTransicion } from "../utils/transicion";
import { configurarDiaInicioMes, configurarMoneda } from "../utils/formato";

interface ContextoConfiguracion {
  /** Todas las preferencias tal y como las devuelve el backend. */
  configuracion: Configuracion;
  /** Moneda principal: la de totales, gráficos y presupuestos. */
  moneda: Moneda;
  /** Monedas que se ofrecen en los formularios. */
  monedasActivas: Moneda[];
  /** Tasas vigentes, para mostrar conversiones aproximadas. */
  tasas: Tasa[];
  actualizarConfiguracion: (cambios: Partial<Configuracion>) => Promise<void>;
  /** Sube una foto ya preparada (data URL) o la borra con null. */
  cambiarFoto: (imagen: string | null) => Promise<void>;
  /** URL de la foto de perfil, o null si no hay. */
  urlFoto: string | null;
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
  nombre: null,
  avatar: null,
  color_acento: "esmeralda",
  estilo_visual: "fintech",
  pagina_inicio: "dashboard",
  dia_inicio_mes: 1,
  widgets: null,
  foto_version: null,
  // Hasta saber lo que dice el backend, nada de asistente ni bienvenida (evita un parpadeo).
  tutorial_visto: true,
  bienvenida_cerrada: true,
  mostrar_consejos: true,
  recordatorio_diario: false,
  hora_recordatorio: 21,
  correo_recordatorios: null,
};

/** Pone acento y estilo en <html> (los leen las variables CSS de index.css). */
function aplicarApariencia(acento: ColorAcento, estilo: EstiloVisual) {
  const html = document.documentElement;
  if (html.dataset.acento === acento && html.dataset.estilo === estilo) return;
  // Fundido suave del color viejo al nuevo, en vez de un cambio brusco.
  conTransicion(() => {
    html.dataset.acento = acento;
    html.dataset.estilo = estilo;
  });
  try {
    // Copia local para que index.html lo aplique antes de pintar en la próxima visita.
    localStorage.setItem("acento", acento);
    localStorage.setItem("estilo", estilo);
  } catch {
    // Navegación privada: no pasa nada, solo se verán los colores un instante después.
  }
}

export function ConfiguracionProvider({ children }: { children: ReactNode }) {
  const [configuracion, setConfiguracion] = useState<Configuracion>(CONFIGURACION_INICIAL);
  const [tasas, setTasas] = useState<Tasa[]>([]);
  const [lista, setLista] = useState(false);

  function aplicar(nueva: Configuracion) {
    configurarMoneda(nueva.moneda);
    configurarDiaInicioMes(nueva.dia_inicio_mes);
    aplicarApariencia(nueva.color_acento, nueva.estilo_visual);
    // Cambiar el estado vuelve a renderizar la app con el nuevo formato.
    setConfiguracion(nueva);
  }

  const recargarTasas = useCallback(async () => {
    setTasas(await tasasApi.listar());
  }, []);

  useEffect(() => {
    // Si el backend no responde, seguimos con valores por defecto;
    // cada página mostrará su propio error al intentar cargar datos.
    configuracionApi.obtener().then(aplicar).catch(() => {}).finally(() => setLista(true));
    // Las tasas no bloquean la primera pantalla (pueden tardar si se están
    // descargando): mientras llegan, `convertir` simplemente devuelve undefined.
    recargarTasas().catch(() => {});
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
      // Las tasas se expresan en la moneda principal: si cambia, hay que pedirlas de nuevo.
      if (cambios.moneda && cambios.moneda !== anterior.moneda) await recargarTasas();
    } catch (e) {
      aplicar(anterior);
      throw e;
    }
  }

  async function cambiarFoto(imagen: string | null) {
    aplicar(imagen ? await configuracionApi.subirFoto(imagen) : await configuracionApi.borrarFoto());
  }

  // No pintamos nada hasta conocer la moneda, para no mostrar importes
  // con un formato y cambiarlos un instante después.
  if (!lista) return null;

  const valor: ContextoConfiguracion = {
    configuracion,
    moneda: configuracion.moneda,
    monedasActivas: configuracion.monedas_activas,
    tasas,
    actualizarConfiguracion,
    recargarTasas,
    cambiarFoto,
    urlFoto: configuracion.foto_version ? configuracionApi.urlFoto(configuracion.foto_version) : null,
    convertir: (monto, de, a = configuracion.moneda) => convertir(monto, de, a, configuracion.moneda, tasas),
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useConfiguracion(): ContextoConfiguracion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useConfiguracion debe usarse dentro de <ConfiguracionProvider>");
  return contexto;
}
