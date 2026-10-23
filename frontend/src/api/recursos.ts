/**
 * Un objeto por recurso del backend con sus operaciones CRUD.
 * Las páginas usan esto en lugar de escribir URLs a mano.
 */
import type {
  AportacionMeta,
  Categoria,
  CobroIngreso,
  Cuenta,
  DatosAbono,
  DatosCobro,
  DatosDeseo,
  DatosDeuda,
  DatosMeta,
  DatosNuevos,
  DecisionDeseo,
  Deseo,
  Deuda,
  EstadoDeseo,
  IngresoRecurrente,
  MesAnio,
  Meta,
  MovimientoImportado,
  Notificacion,
  PaginaTransacciones,
  PagoSuscripcion,
  Presupuesto,
  SentidoDeuda,
  Suscripcion,
  TipoMovimiento,
  Transaccion,
  Transferencia,
  VistaPreviaImportacion,
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

export const ingresosApi = {
  ...crearRecurso<IngresoRecurrente, { proximos_dias?: number }>("/ingresos-recurrentes"),
  registrarCobro: (id: number, datos: DatosCobro) =>
    http.post<CobroIngreso>(`/ingresos-recurrentes/${id}/registrar-cobro`, datos),
  /** Pasa al siguiente periodo sin anotar ningún ingreso. */
  omitir: (id: number) => http.post<IngresoRecurrente>(`/ingresos-recurrentes/${id}/omitir`, {}),
};

/** Las metas no usan crearRecurso: su respuesta trae campos calculados que no se envían. */
export const metasApi = {
  listar: () => http.get<Meta[]>("/metas"),
  crear: (datos: DatosMeta) => http.post<Meta>("/metas", datos),
  /** `cumplida`: marcarla a mano como cumplida (true) o reabrirla (false). */
  actualizar: (id: number, cambios: Partial<DatosMeta> & { cumplida?: boolean }) => http.patch<Meta>(`/metas/${id}`, cambios),
  eliminar: (id: number) => http.delete(`/metas/${id}`),
  aportaciones: (id: number) => http.get<AportacionMeta[]>(`/metas/${id}/aportaciones`),
  aportar: (id: number, datos: Omit<AportacionMeta, "id" | "meta_id">) =>
    http.post<AportacionMeta>(`/metas/${id}/aportaciones`, datos),
  eliminarAportacion: (id: number, aportacionId: number) => http.delete(`/metas/${id}/aportaciones/${aportacionId}`),
};

/** Deudas: las respuestas traen lo abonado y lo pendiente, ya calculados. */
export const deudasApi = {
  listar: (filtros?: { sentido?: SentidoDeuda; pendientes?: boolean }) =>
    http.get<Deuda[]>("/deudas", filtros as Record<string, string>),
  crear: (datos: DatosDeuda) => http.post<Deuda>("/deudas", datos),
  actualizar: (id: number, cambios: Partial<DatosDeuda>) => http.patch<Deuda>(`/deudas/${id}`, cambios),
  eliminar: (id: number) => http.delete(`/deudas/${id}`),
  abonar: (id: number, datos: DatosAbono) => http.post<Deuda>(`/deudas/${id}/abonos`, datos),
  eliminarAbono: (id: number, abonoId: number) => http.delete(`/deudas/${id}/abonos/${abonoId}`),
};

/** Avisos de la campana. */
export const notificacionesApi = {
  listar: () => http.get<Notificacion[]>("/notificaciones"),
  marcarLeidas: (claves: string[]) => http.post<void>("/notificaciones/leidas", { claves }),
};

/** Lista de deseos y máquina del tiempo. */
export const deseosApi = {
  listar: (filtros?: { estado?: EstadoDeseo }) => http.get<Deseo[]>("/deseos", filtros as Record<string, string>),
  /** Con `dias_reflexion`, el deseo entra en la máquina del tiempo. */
  crear: (datos: DatosDeseo & { dias_reflexion?: number | null }) => http.post<Deseo>("/deseos", datos),
  actualizar: (id: number, cambios: Partial<DatosDeseo>) => http.patch<Deseo>(`/deseos/${id}`, cambios),
  eliminar: (id: number) => http.delete(`/deseos/${id}`),
  decidir: (id: number, decision: DecisionDeseo) => http.post<Deseo>(`/deseos/${id}/decidir`, { decision }),
  reflexionar: (id: number, dias: number) => http.post<Deseo>(`/deseos/${id}/reflexionar`, { dias }),
  crearMeta: (id: number) => http.post<Deseo>(`/deseos/${id}/crear-meta`, {}),
};

/** Importar un extracto bancario: primero se ve lo que entraría y luego se confirma. */
export const importacionesApi = {
  /** Lee el archivo (CSV, .xlsx o .xls) en el servidor sin guardar nada. */
  vistaPrevia: (cuentaId: number, archivo: File, invertirSignos: boolean) =>
    http.post<VistaPreviaImportacion>("/importaciones/vista-previa", archivo, {
      cuenta_id: cuentaId,
      invertir_signos: invertirSignos ? "true" : undefined,
    }),
  /** Crea todas las transacciones o ninguna. */
  importar: (cuentaId: number, movimientos: MovimientoImportado[]) =>
    http.post<{ creadas: number }>("/importaciones", { cuenta_id: cuentaId, movimientos }),
};
