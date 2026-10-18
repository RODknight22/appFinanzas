import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";

function EnConstruccion() {
  return <p className="text-slate-500">Esta sección está en construcción.</p>;
}

/** Mapa de rutas: cada URL muestra una página dentro del Layout común. */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="transacciones" element={<EnConstruccion />} />
        <Route path="presupuestos" element={<EnConstruccion />} />
        <Route path="suscripciones" element={<EnConstruccion />} />
        <Route path="cuentas" element={<EnConstruccion />} />
        <Route path="categorias" element={<EnConstruccion />} />
        {/* Cualquier otra URL vuelve al dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
