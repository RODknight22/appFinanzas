import { LayoutGrid, RotateCcw } from "lucide-react";
import { useState } from "react";

import { dashboardApi } from "../api/dashboard";
import { categoriasApi, cuentasApi, ingresosApi, metasApi, suscripcionesApi, transaccionesApi } from "../api/recursos";
import { avisarError } from "../components/ajustes/avisarError";
import { PanelWidgets } from "../components/dashboard/PanelWidgets";
import { EsqueletoPanel } from "../components/dashboard/EsqueletoPanel";
import { CelebracionHito } from "../components/metas/CelebracionHito";
import { DISPOSICION_POR_DEFECTO, reconciliar, type DatosPanel } from "../components/dashboard/registroWidgets";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido } from "../components/ui/Estados";
import { SelectorMes } from "../components/ui/SelectorMes";
import { useConfiguracion } from "../hooks/useConfiguracion";
import { useDatos } from "../hooks/useDatos";
import { useHitosMetas } from "../hooks/useHitosMetas";
import type { WidgetDisposicion } from "../types";
import { proximosPagos } from "../utils/cuentas";
import { mesActual } from "../utils/formato";

/** Días hacia delante que se muestran en "Próximos pagos" y "Próximos cobros". */
const DIAS_PROXIMOS = 14;

export function DashboardPage() {
  const { configuracion, actualizarConfiguracion } = useConfiguracion();
  const [mes, setMes] = useState(mesActual());
  // Mientras se edita, los cambios van a un borrador; solo se guardan al pulsar "Guardar".
  const [borrador, setBorrador] = useState<WidgetDisposicion[] | null>(null);
  const editando = borrador !== null;
  const disposicion = borrador ?? reconciliar(configuracion.widgets);

  // Pedimos todo en paralelo: el panel tarda lo que la petición más lenta.
  const estado = useDatos(
    () =>
      Promise.all([
        dashboardApi.resumen(mes),
        dashboardApi.flujoMensual(mes, 6),
        dashboardApi.gastosPorCategoria(mes),
        dashboardApi.presupuestos(mes),
        suscripcionesApi.listar({ proximos_dias: DIAS_PROXIMOS }),
        cuentasApi.listar(),
        transaccionesApi.listar({ limit: 5 }),
        categoriasApi.listar(),
        metasApi.listar(),
        dashboardApi.patrimonio(mes, 12),
        dashboardApi.gastosDiarios(mes),
        ingresosApi.listar({ proximos_dias: DIAS_PROXIMOS }),
      ]),
    [mes],
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
      <SelectorMes mes={mes} onCambiar={setMes} />
      <Boton variante="secundario" onClick={() => setBorrador(disposicion)}>
        <LayoutGrid size={16} /> Personalizar
      </Boton>
    </>
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Dashboard"
        descripcion={editando ? "Arrastra los widgets por el asa, cambia su tamaño u ocúltalos" : "Resumen de tus finanzas"}
        acciones={acciones}
      />

      <Contenido {...estado} onReintentar={estado.recargar} esqueleto={<EsqueletoPanel />}>
        {([resumen, flujo, gastos, presupuestos, suscripciones, cuentas, ultimas, categorias, metas, patrimonio, diarios, cobros]) => {
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
            mes,
          };
          return (
            // Al cambiar de mes se ven los datos anteriores atenuados hasta que llegan los nuevos.
            <div className={`transition-opacity ${estado.cargando ? "opacity-60" : ""}`}>
              <PanelWidgets disposicion={disposicion} datos={datos} editando={editando} onCambiar={setBorrador} />
            </div>
          );
        }}
      </Contenido>
      {celebracion && <CelebracionHito celebracion={celebracion} onCerrar={cerrar} />}
    </>
  );
}
