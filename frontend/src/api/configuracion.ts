import type { Configuracion } from "../types";
import { http } from "./cliente";

export const configuracionApi = {
  obtener: () => http.get<Configuracion>("/configuracion"),
  actualizar: (cambios: Configuracion) => http.put<Configuracion>("/configuracion", cambios),
};
