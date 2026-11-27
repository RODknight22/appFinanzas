/**
 * Registro de widgets del panel. Para añadir uno nuevo basta con añadirlo a
 * WIDGETS: aparecerá en "Personalizar" para añadirlo al panel (y a la vista desde
 * el principio solo si lleva `visiblePorDefecto`).
 */
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight, Coins, Scale, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import type {
  AhorroAnual,
  BuenMomento as DatosBuenMomento,
  Categoria,
  ComparativaPeriodo,
  CosteEnviosAnio,
  FlujoMensual,
  GastoDiario,
  GastoPorCategoria,
  GastoPorComercio,
  GastoPorCuenta,
  IngresoRecurrente,
  Meta,
  MesAnio,
  Moneda,
  PoderAdquisitivo,
  ProgresoPresupuesto,
  PuntoPatrimonio,
  ResumenMes,
  TamanoWidget,
  Transaccion,
  WidgetDisposicion,
} from "../../types";
import type { PagoProximo } from "../../utils/cuentas";
import { formatearDinero, formatearNumero, formatearPorcentaje } from "../../utils/formato";
import { PERIODOS, textoPeriodo, type Periodo } from "../../utils/periodo";
import { CifraAnimada } from "../ui/CifraAnimada";
import { Vacio } from "../ui/Estados";
import { IconoCategoria } from "../ui/IconoCategoria";
import { BarraMeta } from "../metas/BarraMeta";
import { Tarjeta } from "../ui/Tarjeta";
import { BarraPresupuesto } from "./BarraPresupuesto";
import { CalendarioGastos } from "./CalendarioGastos";
import { GraficoCategorias } from "./GraficoCategorias";
import { GraficoFlujo } from "./GraficoFlujo";
import { GraficoPatrimonio } from "./GraficoPatrimonio";
import { TarjetaMetrica } from "./TarjetaMetrica";
import { AhorroDelAnio } from "./widgets/AhorroDelAnio";
import { BuenMomento } from "./widgets/BuenMomento";
import { Comparativa } from "./widgets/Comparativa";
import { ListaBarras } from "./widgets/ListaBarras";
import { ListaCobros } from "./widgets/ListaCobros";
import { ListaPagos } from "./widgets/ListaPagos";
import { ListaSaldos } from "./widgets/ListaSaldos";
import { ListaUltimas } from "./widgets/ListaUltimas";

/** Todo lo que el dashboard carga una vez y reparte entre los widgets. */
export interface DatosPanel {
  /** El mes que se está viendo (el calendario lo necesita para pintar sus días). */
  mes: MesAnio;
  /** Periodo de ingresos, gastos y repartos; los widgets "del mes" o de saldos lo ignoran. */
  periodo: Periodo;
  /** Moneda principal: la de todos los totales. */
  moneda: Moneda;
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
  /** Coste de los envíos entre monedas del año del mes que se está viendo. */
  costeEnvios: CosteEnviosAnio;
  poder: PoderAdquisitivo;
  /** La tasa de hoy frente a los últimos 90 días: no depende del mes que se vea. */
  buenMomento: DatosBuenMomento;
  comparativa: ComparativaPeriodo;
  comercios: GastoPorComercio[];
  gastosCuenta: GastoPorCuenta[];
  ahorro: AhorroAnual;
}

/**
 * "Gastos · 7D": los widgets que siguen el periodo lo dicen en el título cuando no
 * es el mes (así se distinguen de los que no cambian, como los saldos).
 */
function conPeriodo(titulo: string, periodo: Periodo): string {
  if (periodo === "mes") return titulo;
  return `${titulo} · ${PERIODOS.find((p) => p.valor === periodo)?.etiqueta ?? ""}`;
}

/** La serie mensual (sparkline y variación) solo tiene sentido junto a una cifra mensual. */
const siEsMes = (periodo: Periodo, serie: number[]) => (periodo === "mes" ? serie : undefined);

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** "−8,3 %", con signo: cuánto más (o menos) rinde tu dinero que de media. */
function textoRinde(porcentaje: string | null): string {
  if (porcentaje === null) return "—";
  const valor = Number(porcentaje);
  return `${valor > 0 ? "+" : valor < 0 ? "−" : ""}${formatearPorcentaje(Math.abs(valor))}`;
}

function detallePoder({ moneda_ingreso, moneda_gasto, tasa_mes, tasa_media_12_meses, ingresos, rindio, diferencia }: PoderAdquisitivo): string {
  if (!moneda_ingreso || !moneda_gasto) return "Aparece cuando cobras en una moneda y gastas en otra";
  if (!tasa_mes || !tasa_media_12_meses) return "Hacen falta unas semanas de tasas de cambio para comparar";
  if (ingresos && rindio && diferencia) {
    const menos = Number(diferencia) < 0;
    return `Tus ${formatearDinero(ingresos, moneda_ingreso)} rindieron ${formatearDinero(rindio, moneda_gasto)}: ${formatearDinero(Math.abs(Number(diferencia)), moneda_gasto)} ${menos ? "menos" : "más"} que con la media de 12 meses`;
  }
  return `1 ${moneda_gasto} = ${formatearNumero(Number(tasa_mes), 2)} ${moneda_ingreso} este mes · media de 12 meses: ${formatearNumero(Number(tasa_media_12_meses), 2)}`;
}

interface DefinicionWidget {
  titulo: string;
  tamanoPorDefecto: TamanoWidget;
  /** Los que ve quien empieza (o restablece): un panel ligero; el resto se añade desde "Personalizar". */
  visiblePorDefecto?: boolean;
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
    visiblePorDefecto: true,
    pintar: ({ resumen, patrimonio }) => (
      <TarjetaMetrica
        titulo="Balance global"
        valor={<CifraAnimada valor={resumen.balance_global} />}
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
    visiblePorDefecto: true,
    pintar: ({ resumen, flujo, periodo }) => (
      <TarjetaMetrica
        titulo={conPeriodo("Ingresos", periodo)}
        valor={<CifraAnimada valor={resumen.ingresos} />}
        icono={ArrowUpRight}
        tono="positivo"
        serie={siEsMes(periodo, flujo.map((m) => Number(m.ingresos)))}
      />
    ),
  },
  gastos: {
    titulo: "Gastos del mes",
    tamanoPorDefecto: "pequeno",
    visiblePorDefecto: true,
    pintar: ({ resumen, flujo, periodo }) => (
      <TarjetaMetrica
        titulo={conPeriodo("Gastos", periodo)}
        valor={<CifraAnimada valor={resumen.gastos} />}
        icono={ArrowDownRight}
        tono="negativo"
        serie={siEsMes(periodo, flujo.map((m) => Number(m.gastos)))}
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
    pintar: ({ resumen, flujo, periodo }) => {
      const neto = Number(resumen.flujo_neto);
      const cuando = periodo === "mes" ? "este mes" : `en ${textoPeriodo(periodo, resumen.mes_anio)}`;
      return (
        <TarjetaMetrica
          titulo={conPeriodo("Flujo neto", periodo)}
          valor={formatearDinero(neto)}
          icono={Scale}
          tono={neto >= 0 ? "positivo" : "negativo"}
          detalle={neto >= 0 ? `Has ahorrado ${cuando}` : "Gastaste más de lo que entró"}
          serie={siEsMes(periodo, flujo.map((m) => Number(m.flujo_neto)))}
        />
      );
    },
  },
  grafico_flujo: {
    titulo: "Ingresos vs. gastos",
    tamanoPorDefecto: "mediano",
    visiblePorDefecto: true,
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
    visiblePorDefecto: true,
    pintar: ({ gastos, periodo, mes }) => (
      <Tarjeta titulo={conPeriodo("Gastos por categoría", periodo)} className="h-full">
        <GraficoCategorias datos={gastos} mensajeVacio={`Sin gastos en ${textoPeriodo(periodo, mes)}`} />
      </Tarjeta>
    ),
  },
  categorias_barras: {
    titulo: "Gastos por categoría (barras)",
    tamanoPorDefecto: "mediano",
    pintar: ({ gastos, periodo, mes }) => (
      <Tarjeta titulo={conPeriodo("Gastos por categoría", periodo)} className="h-full">
        {gastos.length === 0 ? (
          <Vacio mensaje={`Sin gastos en ${textoPeriodo(periodo, mes)}`} />
        ) : (
          <ListaBarras
            filas={gastos.slice(0, 6).map((g) => ({
              clave: g.categoria_id,
              nombre: g.nombre,
              total: g.total,
              porcentaje: g.porcentaje,
              color: g.color,
              inicio: <IconoCategoria icono={g.icono} color={g.color} tamano="sm" />,
            }))}
          />
        )}
      </Tarjeta>
    ),
  },
  presupuestos: {
    titulo: "Presupuestos del mes",
    tamanoPorDefecto: "mediano",
    visiblePorDefecto: true,
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
  buen_momento: {
    titulo: "¿Buen momento para cambiar?",
    tamanoPorDefecto: "mediano",
    // Es la seña de la app (cobrar en una moneda y gastar en otra): a la vista desde el principio.
    visiblePorDefecto: true,
    pintar: ({ buenMomento }) => (
      <Tarjeta
        titulo={buenMomento.moneda_ingreso && buenMomento.moneda_gasto ? `¿Buen momento para cambiar ${buenMomento.moneda_ingreso} a ${buenMomento.moneda_gasto}?` : "¿Buen momento para cambiar?"}
        className="h-full"
      >
        <BuenMomento datos={buenMomento} />
      </Tarjeta>
    ),
  },
  poder_adquisitivo: {
    titulo: "Poder adquisitivo",
    tamanoPorDefecto: "pequeno",
    pintar: ({ poder }) => {
      const rinde = Number(poder.rinde_porcentaje ?? 0);
      return (
        <TarjetaMetrica
          titulo={poder.moneda_ingreso && poder.moneda_gasto ? `Rinde tu ${poder.moneda_ingreso} en ${poder.moneda_gasto}` : "Poder adquisitivo"}
          valor={textoRinde(poder.rinde_porcentaje)}
          icono={Coins}
          tono={rinde > 0 ? "positivo" : rinde < 0 ? "negativo" : "neutral"}
          detalle={detallePoder(poder)}
        />
      );
    },
  },
  coste_envios: {
    titulo: "Coste de tus envíos entre monedas",
    tamanoPorDefecto: "pequeno",
    pintar: ({ costeEnvios: { anio, total, moneda, envios, porcentaje_medio } }) => (
      <TarjetaMetrica
        titulo={`Coste envíos ${anio}`}
        valor={formatearDinero(total, moneda)}
        icono={ArrowRightLeft}
        tono={Number(total) > 0 ? "negativo" : "neutral"}
        detalle={
          envios === 0
            ? "Indica lo que llegó en tus transferencias entre monedas"
            : `${envios} ${envios === 1 ? "envío" : "envíos"} · ${formatearPorcentaje(Number(porcentaje_medio))} frente al BCE`
        }
      />
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
    visiblePorDefecto: true,
    pintar: ({ ultimas, categorias }) => (
      <Tarjeta titulo="Últimas transacciones" accion={enlace("/transacciones", "Ver todas")} className="h-full">
        <ListaUltimas transacciones={ultimas} categorias={categorias} />
      </Tarjeta>
    ),
  },
  comparativa: {
    titulo: "Este mes vs anterior",
    tamanoPorDefecto: "mediano",
    pintar: ({ comparativa, periodo, mes }) => (
      <Tarjeta
        titulo={periodo === "mes" ? `${mayuscula(textoPeriodo(periodo, mes))} vs el mes anterior` : `${mayuscula(textoPeriodo(periodo, mes))} vs los anteriores`}
        className="h-full"
      >
        <Comparativa datos={comparativa} />
      </Tarjeta>
    ),
  },
  top_comercios: {
    titulo: "Top 5 comercios",
    tamanoPorDefecto: "mediano",
    pintar: ({ comercios, periodo }) => (
      <Tarjeta titulo={conPeriodo("Dónde más gastaste", periodo)} className="h-full">
        {comercios.length === 0 ? (
          <Vacio mensaje="Sin gastos con descripción en este periodo. El comercio sale de la descripción de cada gasto." />
        ) : (
          <ListaBarras
            filas={comercios.map((c, i) => ({
              clave: c.nombre,
              nombre: c.nombre,
              detalle: `${c.movimientos} ${c.movimientos === 1 ? "gasto" : "gastos"}`,
              total: c.total,
              porcentaje: c.porcentaje,
              inicio: (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-superficie-2 text-xs font-bold text-tenue">
                  {i + 1}
                </span>
              ),
            }))}
          />
        )}
      </Tarjeta>
    ),
  },
  ahorro_anual: {
    titulo: "Ahorro del año",
    tamanoPorDefecto: "mediano",
    pintar: ({ ahorro }) => (
      <Tarjeta titulo={`Ahorro de ${ahorro.anio}`} className="flex h-full flex-col">
        <AhorroDelAnio datos={ahorro} />
      </Tarjeta>
    ),
  },
  gasto_por_cuenta: {
    titulo: "Gasto por cuenta",
    tamanoPorDefecto: "mediano",
    pintar: ({ gastosCuenta, periodo, mes, moneda }) => (
      <Tarjeta titulo={conPeriodo("Gasto por cuenta", periodo)} accion={enlace("/cuentas", "Ver cuentas")} className="h-full">
        {gastosCuenta.length === 0 ? (
          <Vacio mensaje={`Sin gastos en ${textoPeriodo(periodo, mes)}`} />
        ) : (
          <ListaBarras
            filas={gastosCuenta.map((g) => ({
              clave: g.cuenta_id,
              nombre: g.nombre,
              // En otra moneda, también lo que salió de la cuenta tal cual.
              detalle: g.moneda === moneda ? undefined : `${formatearDinero(g.total_cuenta, g.moneda)} en ${g.moneda}`,
              total: g.total,
              porcentaje: g.porcentaje,
            }))}
          />
        )}
      </Tarjeta>
    ),
  },
} satisfies Record<string, DefinicionWidget>;
// `satisfies` comprueba la forma sin perder los nombres exactos de las claves.

export type IdWidget = keyof typeof WIDGETS;

export function esIdWidget(id: string): id is IdWidget {
  return id in WIDGETS;
}

/**
 * El orden en que están escritos en WIDGETS; a la vista solo los marcados como
 * `visiblePorDefecto` (un panel ligero), el resto espera en "Personalizar".
 */
export const DISPOSICION_POR_DEFECTO: WidgetDisposicion[] = Object.entries(WIDGETS).map(([id, w]) => ({
  id,
  tamano: w.tamanoPorDefecto as TamanoWidget,
  visible: "visiblePorDefecto" in w && w.visiblePorDefecto,
}));

/**
 * Une la disposición guardada con los widgets que existen hoy: descarta los
 * que ya no existen y añade al final los que se crearon después (visibles solo
 * si lo son por defecto: un widget nuevo no debe recargar un panel ya personalizado).
 */
export function reconciliar(guardada: WidgetDisposicion[] | null): WidgetDisposicion[] {
  if (!guardada) return DISPOSICION_POR_DEFECTO;
  const conocidos = guardada.filter((w) => esIdWidget(w.id));
  const nuevos = DISPOSICION_POR_DEFECTO.filter((d) => !conocidos.some((w) => w.id === d.id));
  return [...conocidos, ...nuevos];
}
