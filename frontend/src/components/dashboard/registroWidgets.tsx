/**
 * Registro de widgets del panel. Para añadir uno nuevo basta con añadirlo a
 * WIDGETS: aparecerá en el panel y en la lista de widgets que se pueden mostrar.
 */
import { ArrowDownRight, ArrowUpRight, Scale, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type {
  Categoria,
  FlujoMensual,
  GastoDiario,
  GastoPorCategoria,
  IngresoRecurrente,
  Meta,
  MesAnio,
  ProgresoPresupuesto,
  PuntoPatrimonio,
  ResumenMes,
  TamanoWidget,
  Transaccion,
  WidgetDisposicion,
} from "../../types";
import type { PagoProximo } from "../../utils/cuentas";
import { formatearDinero } from "../../utils/formato";
import { Vacio } from "../ui/Estados";
import { BarraMeta } from "../metas/BarraMeta";
import { Tarjeta } from "../ui/Tarjeta";
import { BarraPresupuesto } from "./BarraPresupuesto";
import { CalendarioGastos } from "./CalendarioGastos";
import { GraficoCategorias } from "./GraficoCategorias";
import { GraficoFlujo } from "./GraficoFlujo";
import { GraficoPatrimonio } from "./GraficoPatrimonio";
import { TarjetaMetrica } from "./TarjetaMetrica";
import { ListaCobros } from "./widgets/ListaCobros";
import { ListaPagos } from "./widgets/ListaPagos";
import { ListaSaldos } from "./widgets/ListaSaldos";
import { ListaUltimas } from "./widgets/ListaUltimas";

/** Todo lo que el dashboard carga una vez y reparte entre los widgets. */
export interface DatosPanel {
  /** El mes que se está viendo (el calendario lo necesita para pintar sus días). */
  mes: MesAnio;
  resumen: ResumenMes;
  flujo: FlujoMensual[];
  gastos: GastoPorCategoria[];
  presupuestos: ProgresoPresupuesto[];
  pagos: PagoProximo[];
  cobros: IngresoRecurrente[];
  diasProximos: number;
  ultimas: Transaccion[];
  categorias: Categoria[];
  metas: Meta[];
  patrimonio: PuntoPatrimonio[];
  diarios: GastoDiario[];
}

interface DefinicionWidget {
  titulo: string;
  tamanoPorDefecto: TamanoWidget;
  /** Recibe los datos ya cargados: los widgets solo pintan, no piden nada. */
  pintar: (datos: DatosPanel) => ReactNode;
}

const enlace = (ruta: string, texto: string) => (
  <Link to={ruta} className="text-xs font-medium text-acento-600 hover:underline">{texto}</Link>
);

export const WIDGETS = {
  balance: {
    titulo: "Balance global",
    tamanoPorDefecto: "mediano",
    pintar: ({ resumen, patrimonio }) => (
      <TarjetaMetrica
        titulo="Balance global"
        valor={formatearDinero(resumen.balance_global)}
        icono={Wallet}
        detalle="Todas tus cuentas"
        destacada
        serie={patrimonio.map((p) => Number(p.total))}
      />
    ),
  },
  ingresos: {
    titulo: "Ingresos del mes",
    tamanoPorDefecto: "pequeno",
    pintar: ({ resumen, flujo }) => (
      <TarjetaMetrica
        titulo="Ingresos"
        valor={formatearDinero(resumen.ingresos)}
        icono={ArrowUpRight}
        tono="positivo"
        serie={flujo.map((m) => Number(m.ingresos))}
      />
    ),
  },
  gastos: {
    titulo: "Gastos del mes",
    tamanoPorDefecto: "pequeno",
    pintar: ({ resumen, flujo }) => (
      <TarjetaMetrica
        titulo="Gastos"
        valor={formatearDinero(resumen.gastos)}
        icono={ArrowDownRight}
        tono="negativo"
        serie={flujo.map((m) => Number(m.gastos))}
        subirEsMalo
      />
    ),
  },
  patrimonio: {
    titulo: "Evolución del patrimonio",
    tamanoPorDefecto: "ancho",
    pintar: ({ patrimonio }) => (
      <Tarjeta titulo="Evolución del patrimonio" className="flex h-full flex-col">
        <GraficoPatrimonio datos={patrimonio} />
      </Tarjeta>
    ),
  },
  flujo_neto: {
    titulo: "Flujo neto",
    tamanoPorDefecto: "pequeno",
    pintar: ({ resumen, flujo }) => {
      const neto = Number(resumen.flujo_neto);
      return (
        <TarjetaMetrica
          titulo="Flujo neto"
          valor={formatearDinero(neto)}
          icono={Scale}
          tono={neto >= 0 ? "positivo" : "negativo"}
          detalle={neto >= 0 ? "Has ahorrado este mes" : "Gastaste más de lo que entró"}
          serie={flujo.map((m) => Number(m.flujo_neto))}
        />
      );
    },
  },
  grafico_flujo: {
    titulo: "Ingresos vs. gastos",
    tamanoPorDefecto: "mediano",
    pintar: ({ flujo }) => (
      <Tarjeta titulo="Ingresos vs. gastos (últimos 6 meses)" className="h-full">
        <GraficoFlujo datos={flujo} />
      </Tarjeta>
    ),
  },
  calendario: {
    titulo: "Calendario de gastos",
    tamanoPorDefecto: "mediano",
    pintar: ({ mes, diarios }) => (
      <Tarjeta titulo="Calendario de gastos" className="h-full">
        <CalendarioGastos mes={mes} datos={diarios} />
      </Tarjeta>
    ),
  },
  gastos_categoria: {
    titulo: "Gastos por categoría",
    tamanoPorDefecto: "mediano",
    pintar: ({ gastos }) => (
      <Tarjeta titulo="Gastos por categoría" className="h-full">
        <GraficoCategorias datos={gastos} />
      </Tarjeta>
    ),
  },
  presupuestos: {
    titulo: "Presupuestos del mes",
    tamanoPorDefecto: "mediano",
    pintar: ({ presupuestos }) => (
      <Tarjeta titulo="Presupuestos del mes" accion={enlace("/presupuestos", "Gestionar")} className="h-full">
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
    ),
  },
  saldos: {
    titulo: "Saldo por cuenta",
    tamanoPorDefecto: "mediano",
    pintar: ({ resumen }) => (
      <Tarjeta titulo="Saldo por cuenta" accion={enlace("/cuentas", "Ver cuentas")} className="h-full">
        <ListaSaldos cuentas={resumen.cuentas} />
      </Tarjeta>
    ),
  },
  proximos_pagos: {
    titulo: "Próximos pagos",
    tamanoPorDefecto: "mediano",
    pintar: ({ pagos, diasProximos }) => (
      <Tarjeta titulo={`Próximos pagos (${diasProximos} días)`} accion={enlace("/pagos-fijos", "Ver todas")} className="h-full">
        <ListaPagos pagos={pagos} />
      </Tarjeta>
    ),
  },
  proximos_cobros: {
    titulo: "Próximos cobros",
    tamanoPorDefecto: "mediano",
    pintar: ({ cobros, diasProximos }) => (
      <Tarjeta titulo={`Próximos cobros (${diasProximos} días)`} accion={enlace("/pagos-fijos/ingresos", "Ver todos")} className="h-full">
        <ListaCobros cobros={cobros} />
      </Tarjeta>
    ),
  },
  metas: {
    titulo: "Metas de ahorro",
    tamanoPorDefecto: "mediano",
    pintar: ({ metas }) => {
      // Solo las activas, como mucho 4: el detalle está en la página de Metas.
      const activas = metas.filter((m) => !m.cumplida).slice(0, 4);
      return (
        <Tarjeta titulo="Metas de ahorro" accion={enlace("/metas", "Ver todas")} className="h-full">
          {activas.length === 0 ? (
            <Vacio mensaje={metas.length ? "Has cumplido todas tus metas" : "Aún no tienes metas de ahorro"} />
          ) : (
            <div className="space-y-5">
              {activas.map((meta) => (
                <div key={meta.id}>
                  <BarraMeta meta={meta} conNombre />
                  {meta.ahorro_mensual && (
                    <p className="mt-1 text-xs text-tenue">
                      Ahorra {formatearDinero(meta.ahorro_mensual, meta.moneda)} al mes para llegar a tiempo
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Tarjeta>
      );
    },
  },
  ultimas_transacciones: {
    titulo: "Últimas transacciones",
    tamanoPorDefecto: "mediano",
    pintar: ({ ultimas, categorias }) => (
      <Tarjeta titulo="Últimas transacciones" accion={enlace("/transacciones", "Ver todas")} className="h-full">
        <ListaUltimas transacciones={ultimas} categorias={categorias} />
      </Tarjeta>
    ),
  },
} satisfies Record<string, DefinicionWidget>;
// `satisfies` comprueba la forma sin perder los nombres exactos de las claves.

export type IdWidget = keyof typeof WIDGETS;

export function esIdWidget(id: string): id is IdWidget {
  return id in WIDGETS;
}

/** El orden en que están escritos en WIDGETS, todos visibles. */
export const DISPOSICION_POR_DEFECTO: WidgetDisposicion[] = Object.entries(WIDGETS).map(([id, w]) => ({
  id,
  tamano: w.tamanoPorDefecto as TamanoWidget,
  visible: true,
}));

/**
 * Une la disposición guardada con los widgets que existen hoy: descarta los
 * que ya no existen y añade al final (visibles) los que se crearon después.
 */
export function reconciliar(guardada: WidgetDisposicion[] | null): WidgetDisposicion[] {
  if (!guardada) return DISPOSICION_POR_DEFECTO;
  const conocidos = guardada.filter((w) => esIdWidget(w.id));
  const nuevos = DISPOSICION_POR_DEFECTO.filter((d) => !conocidos.some((w) => w.id === d.id));
  return [...conocidos, ...nuevos];
}
