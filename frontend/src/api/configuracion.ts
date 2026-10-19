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
  /** "1 `moneda` = `en_principal` en la moneda principal". Devuelve todas las tasas. */
  fijarManual: (moneda: Moneda, en_principal: string) => http.put<Tasa[]>(`/tasas/${moneda}`, { en_principal }),
};
