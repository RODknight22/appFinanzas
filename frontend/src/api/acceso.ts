import { http } from "./cliente";

export interface EstadoAcceso {
  /** ¿Ya existe el usuario de la app? */
  configurado: boolean;
  /** ¿Este navegador tiene una sesión válida? */
  autenticado: boolean;
  usuario: string | null;
}

export interface Credenciales {
  usuario: string;
  contrasena: string;
}

// La sesión viaja en una cookie HttpOnly que pone el backend: el navegador la
// envía sola en cada petición y este código nunca la ve.
export const accesoApi = {
  estado: () => http.get<EstadoAcceso>("/auth/estado"),
  registrar: (datos: Credenciales) => http.post<EstadoAcceso>("/auth/registro", datos),
  iniciarSesion: (datos: Credenciales) => http.post<EstadoAcceso>("/auth/login", datos),
  cerrarSesion: () => http.post<void>("/auth/logout", {}),
  cambiarContrasena: (actual: string, nueva: string) =>
    http.post<void>("/auth/cambiar-contrasena", { actual, nueva }),
};
