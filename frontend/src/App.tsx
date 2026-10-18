import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { CategoriasPage } from "./pages/CategoriasPage";
import { CuentasPage } from "./pages/CuentasPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TransaccionesPage } from "./pages/TransaccionesPage";

function EnConstruccion() {
  return <p className="text-slate-500">Esta sección está en construcción.</p>;
}

/** Mapa de rutas: cada URL muestra una página dentro del Layout común. */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="transacciones" element={<TransaccionesPage />} />
        <Route path="presupuestos" element={<EnConstruccion />} />
        <Route path="suscripciones" element={<EnConstruccion />} />
        <Route path="cuentas" element={<CuentasPage />} />
        <Route path="categorias" element={<CategoriasPage />} />
        {/* Cualquier otra URL vuelve al dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
