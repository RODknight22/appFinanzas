// Prueba de humo: todas las páginas cargan, con título y sin errores de consola.
// Las rutas se leen de App.tsx: una página nueva entra sola en la prueba.
import { readFileSync } from "node:fs";

import { BASE, CAPTURAS, comprobar, prueba } from "./comun.mjs";

/**
 * Rutas de App.tsx con su ruta completa: una pestaña anidada ("apariencia" dentro de
 * "ajustes") es "ajustes/apariencia". Se sigue qué <Route> están abiertos, línea a línea.
 */
function leerRutas(codigo) {
  const abiertas = [];
  const rutas = [];
  for (const linea of codigo.split("\n")) {
    const apertura = linea.match(/<Route\s(?:[^>]*?path="([a-z-]+)")?/);
    if (apertura) {
      const completa = [...abiertas, apertura[1]].filter(Boolean).join("/");
      if (apertura[1]) rutas.push(completa);
      if (!linea.trimEnd().endsWith("/>")) abiertas.push(apertura[1] ?? "");
    }
    if (linea.includes("</Route>")) abiertas.pop();
  }
  return rutas;
}

const rutas = leerRutas(readFileSync("/rutas/App.tsx", "utf8"));

await prueba("humo", async ({ pagina, api }) => {
  comprobar(rutas.length >= 5, `${rutas.length} rutas encontradas en App.tsx`);
  // La bienvenida del primer uso taparía todas las capturas: se da por vista (se prueba en bienvenida.mjs).
  await api.patch("/configuracion", { tutorial_visto: true });
  // Algo de datos para que las páginas no estén todas vacías.
  const cuenta = await api.post("/cuentas", { nombre: "BBVA", tipo: "debito", balance_inicial: "1000" });
  const gasto = (await api.get("/categorias")).find((c) => c.tipo === "gasto");
  await api.post("/transacciones", {
    monto: "12.50", tipo: "gasto", fecha: new Date().toISOString().slice(0, 10), notas: "Café",
    categoria_id: gasto.id, cuenta_id: cuenta.id,
  });

  for (const ruta of new Set(rutas)) {
    await pagina.goto(`${BASE}/${ruta}`);
    await pagina.waitForLoadState("networkidle");
    const titulo = await pagina.locator("h1").first().textContent({ timeout: 5000 }).catch(() => null);
    comprobar(Boolean(titulo?.trim()), `/${ruta} carga (“${titulo?.trim()}”)`);
    await pagina.screenshot({ path: `${CAPTURAS}/humo-${ruta.replaceAll("/", "-")}.png` });
  }
});
