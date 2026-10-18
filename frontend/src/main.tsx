import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { ConfiguracionProvider } from "./hooks/useConfiguracion";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ConfiguracionProvider>
        <App />
      </ConfiguracionProvider>
    </BrowserRouter>
  </StrictMode>,
);
