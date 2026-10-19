import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AccesoProvider } from "./hooks/useAcceso";
import { ConfiguracionProvider } from "./hooks/useConfiguracion";
// La fuente va incluida en la app (no se descarga de Google): funciona sin internet.
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
    </BrowserRouter>
  </StrictMode>,
);
