import { LayoutGrid, RotateCcw } from "lucide-react";
import { useState } from "react";

import { dashboardApi } from "../api/dashboard";
import { categoriasApi, cuentasApi, ingresosApi, metasApi, suscripcionesApi, transaccionesApi, transferenciasApi } from "../api/recursos";
import { avisarError } from "../components/ajustes/avisarError";
import { TarjetaBienvenida } from "../components/bienvenida/TarjetaBienvenida";
import { PanelWidgets } from "../components/dashboard/PanelWidgets";
import { EsqueletoPanel } from "../components/dashboard/EsqueletoPanel";
import { SelectorPeriodo } from "../components/dashboard/SelectorPeriodo";
import { CelebracionHito } from "../components/metas/CelebracionHito";
import { DISPOSICION_POR_DEFECTO, reconciliar, type DatosPanel } from "../components/dashboard/registroWidgets";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido } from "../components/ui/Estados";
import { SelectorMes } from "../components/ui/SelectorMes";
import { useConfiguracion } from "../hooks/useConfiguracion";
import { useDatos } from "../hooks/useDatos";
import { useHitosMetas } from "../hooks/useHitosMetas";
import { usePeriodoDashboard } from "../hooks/usePeriodoDashboard";
import type { WidgetDisposicion } from "../types";
import { proximosPagos } from "../utils/cuentas";
import { mesActual } from "../utils/formato";
import { rangoPeriodo } from "../utils/periodo";

/** Días hacia delante que se muestran en "Próximos pagos" y "Próximos cobros". */
const DIAS_PROXIMOS = 14;

export function DashboardPage() {
  const { configuracion, actualizarConfiguracion } = useConfiguracion();
  const [mesElegido, setMes] = useState(mesActual());
  const [periodo, setPeriodo] = usePeriodoDashboard();
  // Con "los últimos días", lo que va por meses (presupuestos, calendario…) muestra el mes en curso.
  const mes = periodo === "mes" ? mesElegido : mesActual();
  // Mientras se edita, los cambios van a un borrador; solo se guardan al pulsar "Guardar".
  const [borrador, setBorrador] = useState<WidgetDisposicion[] | null>(null);
  const editando = borrador !== null;
  const disposicion = borrador ?? reconciliar(configuracion.widgets);

  // Pedimos todo en paralelo: el panel tarda lo que la petición más lenta.
  const estado = useDatos(
    () => {
      // Se calcula al pedir: "los últimos 7 días" terminan hoy aunque la app lleve días abierta.
      const rango = rangoPeriodo(periodo);
      return Promise.all([
        dashboardApi.resumen(mes, rango),
        dashboardApi.flujoMensual(mes, 6),
        dashboardApi.gastosPorCategoria(mes, rango),
        dashboardApi.presupuestos(mes),
        suscripcionesApi.listar({ proximos_dias: DIAS_PROXIMOS }),
        cuentasApi.listar(),
        transaccionesApi.listar({ limit: 5 }),
        categoriasApi.listar(),
        metasApi.listar(),
        dashboardApi.patrimonio(mes, 12),
        dashboardApi.gastosDiarios(mes),
        ingresosApi.listar({ proximos_dias: DIAS_PROXIMOS }),
        transferenciasApi.costes(Number(mes.slice(0, 4))),
        dashboardApi.poderAdquisitivo(mes),
        dashboardApi.comparativa(mes, rango),
        dashboardApi.topComercios(mes, rango),
        dashboardApi.gastosPorCuenta(mes, rango),
        dashboardApi.ahorroAnual(Number(mes.slice(0, 4))),
        dashboardApi.buenMomento(),
      ]);
    },
    // Con tutorial_visto: al terminar la bienvenida se recarga y el panel ya ve la cuenta y el
    // sueldo creados en ella (si no, los primeros pasos seguían sin tachar).
    [mes, periodo, configuracion.tutorial_visto],
    "dashboard",
  );
  // Las metas también se celebran aquí: al abrir la app ves si alguna cruzó un hito.
  const { celebracion, cerrar } = useHitosMetas(estado.datos?.[8]);

  async function guardar() {
    try {
      await actualizarConfiguracion({ widgets: borrador });
      setBorrador(null);
    } catch (e) {
      avisarError(e);
    }
  }

  const acciones = editando ? (
    <>
      <Boton variante="fantasma" onClick={() => setBorrador(DISPOSICION_POR_DEFECTO)}>
        <RotateCcw size={16} /> Restablecer
      </Boton>
      <Boton variante="secundario" onClick={() => setBorrador(null)}>Cancelar</Boton>
      <Boton onClick={guardar}>Guardar</Boton>
    </>
  ) : (
    <>
      <SelectorPeriodo periodo={periodo} onCambiar={setPeriodo} />
      {/* Con "los últimos días" no hay mes que elegir: el periodo termina hoy. */}
      {periodo === "mes" && <SelectorMes mes={mes} onCambiar={setMes} />}
      <Boton variante="secundario" onClick={() => setBorrador(disposicion)}>
        <LayoutGrid size={16} /> Personalizar
      </Boton>
    </>
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Dashboard"
        consejo="Con «Personalizar» mueves, cambias de tamaño, ocultas o añades widgets. «Mes · 3D · 7D…» elige el periodo de ingresos, gastos y repartos; los saldos siempre son los de hoy."
        descripcion={editando ? "Arrastra los widgets por el asa, cambia su tamaño u ocúltalos" : "Resumen de tus finanzas"}
        acciones={acciones}
      />

      <Contenido {...estado} onReintentar={estado.recargar} esqueleto={<EsqueletoPanel />}>
        {([resumen, flujo, gastos, presupuestos, suscripciones, cuentas, ultimas, categorias, metas, patrimonio, diarios, cobros, costeEnvios, poder, comparativa, comercios, gastosCuenta, ahorro, buenMomento]) => {
          const saldos = new Map(resumen.cuentas.map((c) => [c.cuenta_id, Number(c.saldo)]));
          const datos: DatosPanel = {
            resumen,
            flujo,
            gastos,
            presupuestos,
            pagos: proximosPagos(suscripciones, cuentas, saldos, DIAS_PROXIMOS),
            cobros,
            diasProximos: DIAS_PROXIMOS,
            ultimas,
            categorias,
            metas,
            patrimonio,
            diarios,
            costeEnvios,
            poder,
            mes,
            periodo,
            moneda: configuracion.moneda,
            comparativa,
            comercios,
            gastosCuenta,
            ahorro,
            buenMomento,
          };
          return (
            <>
              {/* Después de la bienvenida, no a la vez: un solo recorrido, sin dos "primeros pasos". */}
              {configuracion.tutorial_visto && !configuracion.bienvenida_cerrada && (
                <TarjetaBienvenida
                  progreso={{ cuentas: cuentas.length, transacciones: ultimas.length, presupuestos: presupuestos.length, metas: metas.length }}
                />
              )}
              {/* Al cambiar de mes se ven los datos anteriores atenuados hasta que llegan los nuevos. */}
              <div className={`transition-opacity ${estado.cargando ? "opacity-60" : ""}`}>
                <PanelWidgets disposicion={disposicion} datos={datos} editando={editando} onCambiar={setBorrador} />
              </div>
            </>
          );
        }}
      </Contenido>
      {celebracion && <CelebracionHito celebracion={celebracion} onCerrar={cerrar} />}
    </>
  );
}
