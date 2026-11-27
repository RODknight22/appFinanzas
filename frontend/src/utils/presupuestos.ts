/** Margen (en puntos) antes de avisar: ir un poco por delante del mes es normal (la compra semanal). */
const MARGEN_RITMO = 10;

/**
 * ¿Se gasta más rápido de lo que pasa el mes? P. ej. a mitad de mes (50 %) con el 70 %
 * del presupuesto gastado: a ese ritmo, se acabaría antes de fin de mes.
 */
export function vaAdelantado(porcentajeGastado: number, porcentajeMes: number): boolean {
  return porcentajeGastado > porcentajeMes + MARGEN_RITMO;
}
