/**
 * Cliente HTTP base. Es el único archivo que llama a `fetch`: si algún día
 * cambia la URL o hay que añadir autenticación, solo se toca aquí.
 */

// Vite reenvía /api al backend (ver vite.config.ts).
const URL_BASE = "/api";

/** Error con el código HTTP y el mensaje legible que devolvió el backend. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Quién avisar si una petición devuelve 401 (sesión caducada o cerrada en otro sitio).
let alPerderSesion: (() => void) | null = null;

/** Lo registra el proveedor de acceso para volver a mostrar la pantalla de login. */
export function registrarAlPerderSesion(manejador: () => void): void {
  alPerderSesion = manejador;
}

type ParametrosConsulta = Record<string, string | number | undefined | null>;

/** Convierte { mes_anio: "2026-10", tipo: undefined } en "?mes_anio=2026-10". */
function construirConsulta(parametros?: ParametrosConsulta): string {
  if (!parametros) return "";
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== "") busqueda.set(clave, String(valor));
  }
  const texto = busqueda.toString();
  return texto ? `?${texto}` : "";
}

const MENSAJE_VALIDACION = "Algo no ha ido bien. Revisa los datos e inténtalo de nuevo.";
const MENSAJE_SERVIDOR = "El servidor no ha podido completar la acción. Inténtalo de nuevo en un momento.";

interface ErrorValidacion {
  type: string;
  loc: (string | number)[];
  msg: string;
}

/**
 * Extrae el mensaje de error de la respuesta de FastAPI:
 * - errores propios (400/404/409): { detail: "mensaje" } en español, se muestra tal cual.
 * - errores de validación (422): { detail: [{ type, loc, msg }, ...] }. Pydantic los escribe
 *   en inglés ("Field required"), así que se muestra un texto propio y el detalle va a la
 *   consola. Excepción: los ValueError de nuestros validadores ya traen un texto en español.
 * - errores del servidor (5xx): texto propio; el detalle técnico, a la consola.
 */
async function leerMensajeDeError(respuesta: Response): Promise<string> {
  let cuerpo: { detail?: unknown } | undefined;
  try {
    cuerpo = await respuesta.json();
  } catch {
    // La respuesta no era JSON (p. ej. el backend está caído).
  }
  const detalle = cuerpo?.detail;

  if (respuesta.status >= 500) {
    console.error(`Error ${respuesta.status} del servidor`, detalle ?? respuesta.statusText);
    return MENSAJE_SERVIDOR;
  }
  if (respuesta.status === 422) {
    console.error("Datos rechazados por la validación (422)", detalle);
    if (Array.isArray(detalle) && detalle.length > 0) {
      const errores = detalle as ErrorValidacion[];
      // "Value error, El color debe…": el texto tras la coma lo escribimos nosotros.
      if (errores.every((error) => error.type === "value_error")) {
        return errores.map((error) => error.msg.replace(/^Value error, /, "")).join(" · ");
      }
    }
    return MENSAJE_VALIDACION;
  }
  if (typeof detalle === "string") return detalle;
  return `Error ${respuesta.status}: ${respuesta.statusText || "no se pudo contactar con el servidor"}`;
}

async function peticion<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  // Un archivo (Blob/File) viaja tal cual; cualquier otro cuerpo, como JSON.
  const esArchivo = cuerpo instanceof Blob;
  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_BASE}${ruta}`, {
      method: metodo,
      headers:
        cuerpo === undefined ? undefined : { "Content-Type": esArchivo ? "application/octet-stream" : "application/json" },
      body: cuerpo === undefined ? undefined : esArchivo ? cuerpo : JSON.stringify(cuerpo),
    });
  } catch {
    // fetch solo falla así si no hubo respuesta (la app se cerró, sin red…). El "Failed to
    // fetch" del navegador no le dice nada a nadie; status 0 = no llegó a haber respuesta.
    throw new ApiError(0, "No se pudo conectar con la app. ¿Sigue abierta?");
  }

  if (!respuesta.ok) {
    // Un 401 fuera de /auth significa que la sesión ya no vale (en /auth/login
    // es solo una contraseña incorrecta, y lo muestra el propio formulario).
    if (respuesta.status === 401 && !ruta.startsWith("/auth")) alPerderSesion?.();
    throw new ApiError(respuesta.status, await leerMensajeDeError(respuesta));
  }
  // 204 No Content (p. ej. DELETE) no trae cuerpo que leer.
  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export const http = {
  get: <T>(ruta: string, parametros?: ParametrosConsulta) =>
    peticion<T>("GET", `${ruta}${construirConsulta(parametros)}`),
  post: <T>(ruta: string, cuerpo: unknown, parametros?: ParametrosConsulta) =>
    peticion<T>("POST", `${ruta}${construirConsulta(parametros)}`, cuerpo),
  patch: <T>(ruta: string, cuerpo: unknown) => peticion<T>("PATCH", ruta, cuerpo),
  put: <T>(ruta: string, cuerpo: unknown) => peticion<T>("PUT", ruta, cuerpo),
  // Con cuerpo solo para borrar en lote (la lista de ids no cabe bien en la URL).
  delete: <T = void>(ruta: string, cuerpo?: unknown) => peticion<T>("DELETE", ruta, cuerpo),
};
