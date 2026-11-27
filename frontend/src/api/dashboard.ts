import type {
  AhorroAnual,
  BuenMomento,
  ComparativaPeriodo,
  FlujoMensual,
  GastoDiario,
  GastoPorCategoria,
  GastoPorComercio,
  GastoPorCuenta,
  MesAnio,
  PlanMes,
  PoderAdquisitivo,
  ProgresoPresupuesto,
  PuntoPatrimonio,
  RangoFechas,
  ResumenMes,
} from "../types";
import { http } from "./cliente";

/** Sin rango, el backend usa el mes; con rango, los días desde/hasta (incluidos). */
const periodo = (mes_anio: MesAnio, rango: RangoFechas | null) => ({ mes_anio, ...rango });

export const dashboardApi = {
  buenMomento: () => http.get<BuenMomento>("/dashboard/buen-momento"),
  poderAdquisitivo: (mes_anio: MesAnio) => http.get<PoderAdquisitivo>("/dashboard/poder-adquisitivo", { mes_anio }),
  resumen: (mes_anio: MesAnio, rango: RangoFechas | null = null) =>
    http.get<ResumenMes>("/dashboard/resumen", periodo(mes_anio, rango)),
  flujoMensual: (hasta_mes: MesAnio, meses = 6) =>
    http.get<FlujoMensual[]>("/dashboard/flujo-mensual", { hasta_mes, meses }),
  gastosPorCategoria: (mes_anio: MesAnio, rango: RangoFechas | null = null) =>
    http.get<GastoPorCategoria[]>("/dashboard/gastos-por-categoria", periodo(mes_anio, rango)),
  planMes: (mes_anio: MesAnio) => http.get<PlanMes>("/dashboard/plan-mes", { mes_anio }),
  presupuestos: (mes_anio: MesAnio) =>
    http.get<ProgresoPresupuesto[]>("/dashboard/presupuestos", { mes_anio }),
  patrimonio: (hasta_mes: MesAnio, meses = 12) =>
    http.get<PuntoPatrimonio[]>("/dashboard/patrimonio", { hasta_mes, meses }),
  gastosDiarios: (mes_anio: MesAnio) => http.get<GastoDiario[]>("/dashboard/gastos-diarios", { mes_anio }),
  comparativa: (mes_anio: MesAnio, rango: RangoFechas | null) =>
    http.get<ComparativaPeriodo>("/dashboard/comparativa", periodo(mes_anio, rango)),
  topComercios: (mes_anio: MesAnio, rango: RangoFechas | null, limite = 5) =>
    http.get<GastoPorComercio[]>("/dashboard/top-comercios", { ...periodo(mes_anio, rango), limite }),
  gastosPorCuenta: (mes_anio: MesAnio, rango: RangoFechas | null) =>
    http.get<GastoPorCuenta[]>("/dashboard/gastos-por-cuenta", periodo(mes_anio, rango)),
  ahorroAnual: (anio: number) => http.get<AhorroAnual>("/dashboard/ahorro-anual", { anio }),
};
