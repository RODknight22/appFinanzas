import { lazy, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { SeccionCuentas, SeccionMetas, SeccionPagosFijos } from "./components/Secciones";
import { PAGINAS_INICIO } from "./config";
import { useConfiguracion } from "./hooks/useConfiguracion";
import { DashboardPage } from "./pages/DashboardPage";

// El Dashboard (la página de inicio habitual) va en el paquete principal; el resto
// se descarga la primera vez que se visita. Así la app abre antes.
/** lazy() espera un "export default": lo adaptamos a nuestras exportaciones con nombre. */
function perezosa<N extends string>(cargar: () => Promise<Record<N, ComponentType>>, nombre: N) {
  return lazy(() => cargar().then((modulo) => ({ default: modulo[nombre] })));
}

const TransaccionesPage = perezosa(() => import("./pages/TransaccionesPage"), "TransaccionesPage");
const PresupuestosPage = perezosa(() => import("./pages/PresupuestosPage"), "PresupuestosPage");
const SuscripcionesPage = perezosa(() => import("./pages/SuscripcionesPage"), "SuscripcionesPage");
const IngresosPage = perezosa(() => import("./pages/IngresosPage"), "IngresosPage");
const EfectivoPage = perezosa(() => import("./pages/EfectivoPage"), "EfectivoPage");
const CuentasPage = perezosa(() => import("./pages/CuentasPage"), "CuentasPage");
const DeseosPage = perezosa(() => import("./pages/DeseosPage"), "DeseosPage");
const DeudasPage = perezosa(() => import("./pages/DeudasPage"), "DeudasPage");
const MetasPage = perezosa(() => import("./pages/MetasPage"), "MetasPage");
const CategoriasPage = perezosa(() => import("./pages/CategoriasPage"), "CategoriasPage");
const AjustesPage = perezosa(() => import("./pages/AjustesPage"), "AjustesPage");

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
        <Route path="ajustes" element={<AjustesPage />} />
        {/* Cualquier otra URL vuelve a la página de inicio */}
        <Route path="*" element={<Navigate to={inicio} replace />} />
      </Route>
    </Routes>
  );
}
