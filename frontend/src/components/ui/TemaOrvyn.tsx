import { useLayoutEffect, type ReactNode } from "react";

import { ConfiguracionFija } from "../../hooks/useConfiguracion";
import type { ColorAcento, EstiloVisual } from "../../types";

interface TemaOrvynProps {
  /** Claro u oscuro. Sin indicarlo, sigue el `data-theme` de la página (Claude Design) y si no, oscuro. */
  modo?: "claro" | "oscuro";
  estilo?: EstiloVisual;
  acento?: ColorAcento;
  children: ReactNode;
}

/**
 * Envoltorio para usar los componentes fuera de la app (Claude Design, vistas previas).
 * Pone en <html> el modo, el estilo y el acento que leen los colores de index.css (en la app
 * lo hace useConfiguracion) y da una configuración fija de ejemplo, sin backend.
 */
export function TemaOrvyn({ modo, estilo = "orvyn", acento = "saffron", children }: TemaOrvynProps) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const oscuro = modo ? modo === "oscuro" : html.dataset.theme !== "light";
    html.classList.toggle("dark", oscuro);
    html.dataset.estilo = estilo;
    html.dataset.acento = acento;
    // El fondo y el texto de la página, por si quien nos aloja (un marco de vista previa)
    // pinta su propio <body> encima del de index.css.
    document.body.style.background = "var(--fondo)";
    document.body.style.color = "var(--texto)";
  }, [modo, estilo, acento]);
  return <ConfiguracionFija>{children}</ConfiguracionFija>;
}
