/**
 * Tablón de avisos de la app: toasts y diálogo de confirmación.
 *
 * Vive fuera de React para que cualquier función (no solo componentes) pueda avisar o pedir
 * confirmación, como hacían `alert` y `confirm`. El componente <Avisos> se suscribe y lo pinta.
 */

export type TipoAviso = "error" | "exito";

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  texto: string;
}

export interface Confirmacion {
  mensaje: string;
  /** Texto del botón que acepta (p. ej. "Eliminar"). */
  textoAceptar: string;
  /** Acción que no se puede deshacer: el botón sale en rojo. */
  peligro: boolean;
  responder: (aceptado: boolean) => void;
}

export interface EstadoAvisos {
  avisos: Aviso[];
  confirmacion: Confirmacion | null;
}

/** Los errores se leen con más calma que los éxitos. */
const DURACION_MS: Record<TipoAviso, number> = { error: 7000, exito: 4000 };
/** Más de tres a la vez taparían la página: se van primero los más viejos. */
const MAXIMO_AVISOS = 3;

let estado: EstadoAvisos = { avisos: [], confirmacion: null };
let siguienteId = 1;
const oyentes = new Set<() => void>();

// Cada cambio crea un objeto nuevo: así React (useSyncExternalStore) nota que hay que repintar.
function cambiar(nuevo: Partial<EstadoAvisos>): void {
  estado = { ...estado, ...nuevo };
  oyentes.forEach((oyente) => oyente());
}

export function suscribirse(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function leerEstado(): EstadoAvisos {
  return estado;
}

/** Muestra un toast que se cierra solo pasados unos segundos. */
export function avisar(texto: string, tipo: TipoAviso = "exito"): void {
  const id = siguienteId++;
  cambiar({ avisos: [...estado.avisos, { id, tipo, texto }].slice(-MAXIMO_AVISOS) });
  window.setTimeout(() => cerrarAviso(id), DURACION_MS[tipo]);
}

export function cerrarAviso(id: number): void {
  if (estado.avisos.some((a) => a.id === id)) cambiar({ avisos: estado.avisos.filter((a) => a.id !== id) });
}

/**
 * Pide confirmación con el diálogo propio. La promesa se resuelve cuando la persona responde:
 * `if (!(await confirmar("¿Eliminar…?"))) return;`
 */
export function confirmar(
  mensaje: string,
  { textoAceptar = "Aceptar", peligro = false }: { textoAceptar?: string; peligro?: boolean } = {},
): Promise<boolean> {
  // Si ya había un diálogo abierto (raro: doble clic), se da por cancelado.
  estado.confirmacion?.responder(false);
  return new Promise((resolver) => {
    const confirmacion: Confirmacion = {
      mensaje,
      textoAceptar,
      peligro,
      responder: (aceptado) => {
        // Solo cierra si sigue siendo el diálogo visible (un doble clic no cierra el siguiente).
        if (estado.confirmacion === confirmacion) cambiar({ confirmacion: null });
        resolver(aceptado);
      },
    };
    cambiar({ confirmacion });
  });
}
