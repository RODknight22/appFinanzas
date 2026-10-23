import { Navigate, Route, Routes } from "react-router";

import { Layout } from "./components/Layout";
import { SeccionAjustes, SeccionCuentas, SeccionMetas, SeccionPagosFijos } from "./components/Secciones";
import { PAGINAS_INICIO } from "./config";
import { useConfiguracion } from "./hooks/useConfiguracion";
import { DashboardPage } from "./pages/DashboardPage";
import {
  AjustesAparienciaPage,
  AjustesMonedasPage,
  AjustesPerfilPage,
  AjustesSeguridadPage,
  CategoriasPage,
  CuentasPage,
  DeseosPage,
  DeudasPage,
  EfectivoPage,
  IngresosPage,
  MetasPage,
  PresupuestosPage,
  SuscripcionesPage,
  TransaccionesPage,
} from "./paginas";

/** Mapa de rutas: cada URL muestra una página dentro del Layout común. */
export default function App() {
  const { configuracion } = useConfiguracion();
  const inicio = PAGINAS_INICIO[configuracion.pagina_inicio].ruta;

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* La raíz lleva a la página de inicio elegida en Ajustes */}
        <Route index element={<Navigate to={inicio} replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="transacciones" element={<TransaccionesPage />} />
        <Route path="presupuestos" element={<PresupuestosPage />} />
        <Route path="pagos-fijos" element={<SeccionPagosFijos />}>
          <Route index element={<SuscripcionesPage />} />
          <Route path="ingresos" element={<IngresosPage />} />
        </Route>
        <Route path="cuentas" element={<SeccionCuentas />}>
          <Route index element={<CuentasPage />} />
          <Route path="efectivo" element={<EfectivoPage />} />
        </Route>
        <Route path="metas" element={<SeccionMetas />}>
          <Route index element={<MetasPage />} />
          <Route path="deseos" element={<DeseosPage />} />
        </Route>
        <Route path="deudas" element={<DeudasPage />} />
        <Route path="categorias" element={<CategoriasPage />} />
        {/* Direcciones antiguas (avisos, marcadores): ahora son pestañas de otra sección */}
        <Route path="efectivo" element={<Navigate to="/cuentas/efectivo" replace />} />
        <Route path="deseos" element={<Navigate to="/metas/deseos" replace />} />
        <Route path="suscripciones" element={<Navigate to="/pagos-fijos" replace />} />
        <Route path="ingresos" element={<Navigate to="/pagos-fijos/ingresos" replace />} />
        <Route path="ajustes" element={<SeccionAjustes />}>
          <Route index element={<AjustesPerfilPage />} />
          <Route path="apariencia" element={<AjustesAparienciaPage />} />
          <Route path="monedas" element={<AjustesMonedasPage />} />
          <Route path="seguridad" element={<AjustesSeguridadPage />} />
        </Route>
        {/* Cualquier otra URL vuelve a la página de inicio */}
        <Route path="*" element={<Navigate to={inicio} replace />} />
      </Route>
    </Routes>
  );
}
