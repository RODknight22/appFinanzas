import type { Categoria, TipoMovimiento, Transaccion } from "../types";

/** Las categorías del tipo más usadas en `transacciones`, primero; el resto, en el orden en que se crearon. */
export function ordenarPorUso(categorias: Categoria[], transacciones: Transaccion[], tipo: TipoMovimiento): Categoria[] {
  const usos = new Map<number, number>();
  for (const t of transacciones) usos.set(t.categoria_id, (usos.get(t.categoria_id) ?? 0) + 1);
  return categorias
    .filter((c) => c.tipo === tipo)
    .sort((a, b) => (usos.get(b.id) ?? 0) - (usos.get(a.id) ?? 0) || a.id - b.id);
}
