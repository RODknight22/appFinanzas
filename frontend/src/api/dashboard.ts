import type {
  FlujoMensual,
  GastoDiario,
  GastoPorCategoria,
  MesAnio,
  PoderAdquisitivo,
  ProgresoPresupuesto,
  PuntoPatrimonio,
  ResumenMes,
} from "../types";
import { http } from "./cliente";

export const dashboardApi = {
  poderAdquisitivo: (mes_anio: MesAnio) => http.get<PoderAdquisitivo>("/dashboard/poder-adquisitivo", { mes_anio }),
  resumen: (mes_anio: MesAnio) => http.get<ResumenMes>("/dashboard/resumen", { mes_anio }),
  flujoMensual: (hasta_mes: MesAnio, meses = 6) =>
    http.get<FlujoMensual[]>("/dashboard/flujo-mensual", { hasta_mes, meses }),
  gastosPorCategoria: (mes_anio: MesAnio) =>
    http.get<GastoPorCategoria[]>("/dashboard/gastos-por-categoria", { mes_anio }),
  presupuestos: (mes_anio: MesAnio) =>
    http.get<ProgresoPresupuesto[]>("/dashboard/presupuestos", { mes_anio }),
  patrimonio: (hasta_mes: MesAnio, meses = 12) =>
    http.get<PuntoPatrimonio[]>("/dashboard/patrimonio", { hasta_mes, meses }),
  gastosDiarios: (mes_anio: MesAnio) => http.get<GastoDiario[]>("/dashboard/gastos-diarios", { mes_anio }),
};
