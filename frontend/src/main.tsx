import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import App from "./App";
import { Avisos } from "./components/ui/Avisos";
import { AccesoProvider } from "./hooks/useAcceso";
import { ConfiguracionProvider } from "./hooks/useConfiguracion";
// Las fuentes van incluidas en la app (no se descargan de Google): funciona sin internet.
// Inter para la interfaz y las cifras; Manrope para los títulos (marca ORVYN).
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      {/* Primero el acceso: sin sesión, el resto de la app ni se carga */}
      <AccesoProvider>
        <ConfiguracionProvider>
          <App />
        </ConfiguracionProvider>
      </AccesoProvider>
      {/* Fuera del acceso: los avisos también sirven en la pantalla de inicio de sesión */}
      <Avisos />
    </BrowserRouter>
  </StrictMode>,
);
