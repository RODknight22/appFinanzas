/** El texto que se enseña de cualquier error (de la API, de red o de lo que sea). */
export function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
