import { useState } from "react";

import { conTransicion } from "../utils/transicion";

export type Tema = "claro" | "oscuro";

function temaInicial(): Tema {
  // index.html ya aplicó la clase antes de cargar React; la leemos de ahí.
  return document.documentElement.classList.contains("dark") ? "oscuro" : "claro";
}

/** Modo claro/oscuro: aplica la clase `dark` en <html> y recuerda la elección. */
export function useTema() {
  const [tema, setTema] = useState<Tema>(temaInicial);

  function alternar() {
    const nuevo: Tema = tema === "oscuro" ? "claro" : "oscuro";
    // La clase se pone aquí mismo (no en un efecto) para que el fundido capture el cambio.
    conTransicion(() => document.documentElement.classList.toggle("dark", nuevo === "oscuro"));
    setTema(nuevo);
    try {
      localStorage.setItem("tema", nuevo);
    } catch {
      // Navegación privada u otro bloqueo: el tema simplemente no se recordará.
    }
  }

  return { tema, alternar };
}
