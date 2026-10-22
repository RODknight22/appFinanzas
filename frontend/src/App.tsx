import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { SeccionCuentas } from "./components/cuentas/SeccionCuentas";
import { PAGINAS_INICIO } from "./config";
import { useConfiguracion } from "./hooks/useConfiguracion";
import { DashboardPage } from "./pages/DashboardPage";
import {
  AjustesPage,
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
        <Route path="suscripciones" element={<SuscripcionesPage />} />
        <Route path="ingresos" element={<IngresosPage />} />
        <Route path="cuentas" element={<SeccionCuentas />}>
          <Route index element={<CuentasPage />} />
          <Route path="efectivo" element={<EfectivoPage />} />
        </Route>
        {/* Dirección antigua: Efectivo ahora es una pestaña de Cuentas */}
        <Route path="efectivo" element={<Navigate to="/cuentas/efectivo" replace />} />
        <Route path="metas" element={<MetasPage />} />
        <Route path="deudas" element={<DeudasPage />} />
        <Route path="deseos" element={<DeseosPage />} />
        <Route path="categorias" element={<CategoriasPage />} />
        <Route path="ajustes" element={<AjustesPage />} />
        {/* Cualquier otra URL vuelve a la página de inicio */}
        <Route path="*" element={<Navigate to={inicio} replace />} />
      </Route>
    </Routes>
  );
}
