/** Cálculos para mostrar tendencias ("▲ 12 % vs. mes pasado"). */

/** Variación porcentual entre el último valor y el anterior (null si no se puede calcular). */
export function variacion(valores: number[]): number | null {
  if (valores.length < 2) return null;
  const anterior = valores[valores.length - 2];
  const actual = valores[valores.length - 1];
  if (anterior === 0) return null; // de 0 a algo no es un porcentaje con sentido
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}
