/**
 * Un objeto por recurso del backend con sus operaciones CRUD.
 * Las páginas usan esto en lugar de escribir URLs a mano.
 */
import type {
  Categoria,
  Cuenta,
  DatosNuevos,
  MesAnio,
  PaginaTransacciones,
  PagoSuscripcion,
  Presupuesto,
  Suscripcion,
  TipoMovimiento,
  Transaccion,
  Transferencia,
} from "../types";
import { http } from "./cliente";

/**
 * Todos los recursos siguen el mismo patrón REST (GET/POST/PATCH/DELETE),
 * así que generamos sus funciones en vez de repetirlas cinco veces.
 */
function crearRecurso<T extends { id: number }, Filtros extends object = object>(ruta: string) {
  return {
    listar: (filtros?: Filtros) => http.get<T[]>(ruta, filtros as Record<string, string>),
    obtener: (id: number) => http.get<T>(`${ruta}/${id}`),
    crear: (datos: DatosNuevos<T>) => http.post<T>(ruta, datos),
    actualizar: (id: number, cambios: Partial<DatosNuevos<T>>) =>
      http.patch<T>(`${ruta}/${id}`, cambios),
    eliminar: (id: number) => http.delete(`${ruta}/${id}`),
  };
}

export interface FiltrosTransacciones {
  desde?: string;
  hasta?: string;
  tipo?: TipoMovimiento;
  cuenta_id?: number;
  categoria_id?: number;
  /** Busca en notas y nombre de categoría (sin importar mayúsculas ni tildes). */
  texto?: string;
  /** Sobre el importe tal como se escribió, en su moneda. */
  monto_min?: string;
  monto_max?: string;
  offset?: number;
  limit?: number;
}

export const cuentasApi = {
  ...crearRecurso<Cuenta>("/cuentas"),
  registrarRendimientos: (id: number) =>
    http.post<Transaccion>(`/cuentas/${id}/registrar-rendimientos`, {}),
};

export const categoriasApi = crearRecurso<Categoria, { tipo?: TipoMovimiento }>("/categorias");
export const transaccionesApi = {
  ...crearRecurso<Transaccion, FiltrosTransacciones>("/transacciones"),
  /** Una página de resultados con el total de coincidencias y sus sumas. */
  buscar: (filtros: FiltrosTransacciones) =>
    http.get<PaginaTransacciones>("/transacciones/buscar", filtros as Record<string, string>),
};
export const transferenciasApi = crearRecurso<Transferencia, { cuenta_id?: number; limit?: number }>("/transferencias");
export const presupuestosApi = crearRecurso<Presupuesto, { mes_anio?: MesAnio }>("/presupuestos");

export const suscripcionesApi = {
  ...crearRecurso<Suscripcion, { proximos_dias?: number }>("/suscripciones"),
  registrarPago: (id: number, datos: { cuenta_id: number; categoria_id: number }) =>
    http.post<PagoSuscripcion>(`/suscripciones/${id}/registrar-pago`, datos),
};
