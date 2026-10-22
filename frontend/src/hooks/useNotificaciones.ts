import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { notificacionesApi } from "../api/recursos";
import type { Notificacion } from "../types";

const CADA_5_MINUTOS = 5 * 60 * 1000;

export interface EstadoNotificaciones {
  avisos: Notificacion[];
  marcarLeidas: (claves: string[]) => void;
}

/** Avisos de la campana: se recargan al cambiar de página y cada 5 minutos. */
export function useNotificaciones(): EstadoNotificaciones {
  const [avisos, setAvisos] = useState<Notificacion[]>([]);
  const { pathname } = useLocation();

  const cargar = useCallback(() => {
    // Un fallo aquí no debe molestar: la campana simplemente no se actualiza.
    notificacionesApi.listar().then(setAvisos).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = window.setInterval(cargar, CADA_5_MINUTOS);
    return () => window.clearInterval(intervalo);
  }, [cargar, pathname]);

  const marcarLeidas = useCallback(
    (claves: string[]) => {
      if (claves.length === 0) return;
      // Optimista: se ven leídas al instante; si falla, la próxima carga lo corrige.
      setAvisos((actuales) => actuales.map((a) => (claves.includes(a.clave) ? { ...a, leida: true } : a)));
      notificacionesApi.marcarLeidas(claves).catch(cargar);
    },
    [cargar],
  );

  return { avisos, marcarLeidas };
}
