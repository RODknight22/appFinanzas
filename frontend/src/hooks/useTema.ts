import { useEffect, useState } from "react";

export type Tema = "claro" | "oscuro";

function temaInicial(): Tema {
  // index.html ya aplicó la clase antes de cargar React; la leemos de ahí.
  return document.documentElement.classList.contains("dark") ? "oscuro" : "claro";
}

/** Modo claro/oscuro: aplica la clase `dark` en <html> y recuerda la elección. */
export function useTema() {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "oscuro");
    try {
      localStorage.setItem("tema", tema);
    } catch {
      // Navegación privada u otro bloqueo: el tema simplemente no se recordará.
    }
  }, [tema]);

  const alternar = () => setTema((actual) => (actual === "oscuro" ? "claro" : "oscuro"));
  return { tema, alternar };
}
