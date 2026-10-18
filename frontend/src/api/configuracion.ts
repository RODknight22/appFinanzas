import type { Configuracion, Moneda, Tasa } from "../types";
import { http } from "./cliente";

export const configuracionApi = {
  obtener: () => http.get<Configuracion>("/configuracion"),
  actualizar: (cambios: Partial<Configuracion>) => http.patch<Configuracion>("/configuracion", cambios),
};

export const tasasApi = {
  /** Tasa vigente de cada moneda (el backend descarga las de hoy si faltan). */
  listar: () => http.get<Tasa[]>("/tasas"),
  actualizarDesdeInternet: () => http.post<Tasa[]>("/tasas/actualizar", {}),
  fijarManual: (moneda: Moneda, por_usd: string) => http.put<Tasa>(`/tasas/${moneda}`, { por_usd }),
};
