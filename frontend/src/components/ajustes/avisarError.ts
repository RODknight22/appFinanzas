/** Muestra en un aviso el mensaje de un error de la API (para acciones sin formulario). */
export function avisarError(e: unknown): void {
  window.alert(e instanceof Error ? e.message : String(e));
}
