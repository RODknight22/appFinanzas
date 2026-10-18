import type {
  FlujoMensual,
  GastoPorCategoria,
  MesAnio,
  ProgresoPresupuesto,
  ResumenMes,
} from "../types";
import { http } from "./cliente";

export const dashboardApi = {
  resumen: (mes_anio: MesAnio) => http.get<ResumenMes>("/dashboard/resumen", { mes_anio }),
  flujoMensual: (hasta_mes: MesAnio, meses = 6) =>
    http.get<FlujoMensual[]>("/dashboard/flujo-mensual", { hasta_mes, meses }),
  gastosPorCategoria: (mes_anio: MesAnio) =>
    http.get<GastoPorCategoria[]>("/dashboard/gastos-por-categoria", { mes_anio }),
  presupuestos: (mes_anio: MesAnio) =>
    http.get<ProgresoPresupuesto[]>("/dashboard/presupuestos", { mes_anio }),
};
