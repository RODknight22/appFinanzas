import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { AjustesPage } from "./pages/AjustesPage";
import { CategoriasPage } from "./pages/CategoriasPage";
import { CuentasPage } from "./pages/CuentasPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PresupuestosPage } from "./pages/PresupuestosPage";
import { SuscripcionesPage } from "./pages/SuscripcionesPage";
import { TransaccionesPage } from "./pages/TransaccionesPage";

/** Mapa de rutas: cada URL muestra una página dentro del Layout común. */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="transacciones" element={<TransaccionesPage />} />
        <Route path="presupuestos" element={<PresupuestosPage />} />
        <Route path="suscripciones" element={<SuscripcionesPage />} />
        <Route path="cuentas" element={<CuentasPage />} />
        <Route path="categorias" element={<CategoriasPage />} />
        <Route path="ajustes" element={<AjustesPage />} />
        {/* Cualquier otra URL vuelve al dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
