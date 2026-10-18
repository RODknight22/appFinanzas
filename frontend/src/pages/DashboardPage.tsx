import { ArrowDownRight, ArrowUpRight, CalendarClock, Scale, Wallet } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { dashboardApi } from "../api/dashboard";
import { suscripcionesApi } from "../api/recursos";
import { BarraPresupuesto } from "../components/dashboard/BarraPresupuesto";
import { GraficoCategorias } from "../components/dashboard/GraficoCategorias";
import { GraficoFlujo } from "../components/dashboard/GraficoFlujo";
import { TarjetaMetrica } from "../components/dashboard/TarjetaMetrica";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido, Vacio } from "../components/ui/Estados";
import { SelectorMes } from "../components/ui/SelectorMes";
import { Tarjeta } from "../components/ui/Tarjeta";
import { useDatos } from "../hooks/useDatos";
import { diasHasta, formatearDinero, formatearFecha, mesActual } from "../utils/formato";

/** Texto amigable para la fecha de un cobro: "Hoy", "En 3 días", "Atrasado 2 días". */
function textoVencimiento(fecha: string): string {
  const dias = diasHasta(fecha);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias < 0) return `Atrasado ${-dias} día${dias === -1 ? "" : "s"}`;
  return `En ${dias} días`;
}

export function DashboardPage() {
  const [mes, setMes] = useState(mesActual());

  // Pedimos todo en paralelo: el dashboard tarda lo que la petición más lenta.
  const estado = useDatos(
    () =>
      Promise.all([
        dashboardApi.resumen(mes),
        dashboardApi.flujoMensual(mes, 6),
        dashboardApi.gastosPorCategoria(mes),
        dashboardApi.presupuestos(mes),
        suscripcionesApi.listar({ proximos_dias: 14 }),
      ]),
    [mes],
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Dashboard"
        descripcion="Resumen de tus finanzas"
        acciones={<SelectorMes mes={mes} onCambiar={setMes} />}
      />

      <Contenido {...estado} onReintentar={estado.recargar}>
        {([resumen, flujo, gastos, presupuestos, proximosPagos]) => {
          const flujoNeto = Number(resumen.flujo_neto);
          return (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <TarjetaMetrica titulo="Balance global" valor={formatearDinero(resumen.balance_global)} icono={Wallet} detalle="Todas tus cuentas" />
                <TarjetaMetrica titulo="Ingresos del mes" valor={formatearDinero(resumen.ingresos)} icono={ArrowUpRight} tono="positivo" />
                <TarjetaMetrica titulo="Gastos del mes" valor={formatearDinero(resumen.gastos)} icono={ArrowDownRight} tono="negativo" />
                <TarjetaMetrica
                  titulo="Flujo neto"
                  valor={formatearDinero(flujoNeto)}
                  icono={Scale}
                  tono={flujoNeto >= 0 ? "positivo" : "negativo"}
                  detalle={flujoNeto >= 0 ? "Has ahorrado este mes" : "Has gastado más de lo que ingresaste"}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Tarjeta titulo="Ingresos vs. gastos (últimos 6 meses)" className="lg:col-span-2">
                  <GraficoFlujo datos={flujo} />
                </Tarjeta>
                <Tarjeta titulo="Gastos por categoría">
                  <GraficoCategorias datos={gastos} />
                </Tarjeta>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Tarjeta
                  titulo="Presupuestos del mes"
                  accion={<Link to="/presupuestos" className="text-xs font-medium text-emerald-600 hover:underline">Gestionar</Link>}
                >
                  {presupuestos.length === 0 ? (
                    <Vacio mensaje="No hay presupuestos para este mes" />
                  ) : (
                    <div className="space-y-5">
                      {presupuestos.map((progreso) => (
                        <BarraPresupuesto key={progreso.presupuesto_id} progreso={progreso} />
                      ))}
                    </div>
                  )}
                </Tarjeta>

                <Tarjeta titulo="Saldo por cuenta">
                  {resumen.cuentas.length === 0 ? (
                    <Vacio mensaje="Aún no tienes cuentas" />
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {resumen.cuentas.map((cuenta) => (
                        <li key={cuenta.cuenta_id} className="flex items-center justify-between py-2.5 text-sm">
                          <span>
                            <span className="font-medium">{cuenta.nombre}</span>
                            <span className="ml-2 text-xs capitalize text-slate-500">{cuenta.tipo}</span>
                          </span>
                          <span className={`font-semibold tabular-nums ${Number(cuenta.saldo) < 0 ? "text-rose-600" : ""}`}>
                            {formatearDinero(cuenta.saldo)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Tarjeta>

                <Tarjeta
                  titulo="Próximos cobros (14 días)"
                  accion={<Link to="/suscripciones" className="text-xs font-medium text-emerald-600 hover:underline">Ver todas</Link>}
                >
                  {proximosPagos.length === 0 ? (
                    <Vacio mensaje="Nada que pagar en los próximos días" />
                  ) : (
                    <ul className="space-y-3">
                      {proximosPagos.map((suscripcion) => (
                        <li key={suscripcion.id} className="flex items-center gap-3 text-sm">
                          <span className="rounded-lg bg-slate-100 p-2 text-slate-500 dark:bg-slate-800">
                            <CalendarClock size={16} />
                          </span>
                          <span className="flex-1">
                            <span className="block font-medium">{suscripcion.nombre}</span>
                            <span className={`text-xs ${diasHasta(suscripcion.fecha_proximo_pago) < 0 ? "text-rose-600" : "text-slate-500"}`}>
                              {textoVencimiento(suscripcion.fecha_proximo_pago)} · {formatearFecha(suscripcion.fecha_proximo_pago)}
                            </span>
                          </span>
                          <span className="font-medium tabular-nums">{formatearDinero(suscripcion.monto)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Tarjeta>
              </div>
            </div>
          );
        }}
      </Contenido>
    </>
  );
}
