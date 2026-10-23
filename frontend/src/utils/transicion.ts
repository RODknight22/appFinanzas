/**
 * Aplica un cambio visual con un fundido entre el antes y el después (View Transitions
 * del navegador: sin librerías y sin coste en la carga). `cambio` debe tocar el DOM
 * directamente (p. ej. una clase en <html>), no vía estado de React. Ojo: el navegador
 * primero fotografía la pantalla y ejecuta `cambio` en el siguiente fotograma, no al
 * instante. Si no lo admite o la persona pidió menos movimiento, se aplica sin más.
 */
export function conTransicion(cambio: () => void): void {
  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || sinMovimiento) {
    cambio();
    return;
  }
  document.startViewTransition(cambio);
}
