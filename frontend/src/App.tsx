import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { PAGINAS_INICIO } from "./config";
import { useConfiguracion } from "./hooks/useConfiguracion";
import { AjustesPage } from "./pages/AjustesPage";
import { CategoriasPage } from "./pages/CategoriasPage";
import { CuentasPage } from "./pages/CuentasPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PresupuestosPage } from "./pages/PresupuestosPage";
import { SuscripcionesPage } from "./pages/SuscripcionesPage";
import { TransaccionesPage } from "./pages/TransaccionesPage";

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
        <Route path="cuentas" element={<CuentasPage />} />
        <Route path="categorias" element={<CategoriasPage />} />
        <Route path="ajustes" element={<AjustesPage />} />
        {/* Cualquier otra URL vuelve a la página de inicio */}
        <Route path="*" element={<Navigate to={inicio} replace />} />
      </Route>
    </Routes>
  );
}
