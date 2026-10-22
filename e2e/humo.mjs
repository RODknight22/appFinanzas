// Prueba de humo: todas las páginas cargan, con título y sin errores de consola.
// Las rutas se leen de App.tsx: una página nueva entra sola en la prueba.
import { readFileSync } from "node:fs";

import { BASE, CAPTURAS, comprobar, prueba } from "./comun.mjs";

const rutas = [...readFileSync("/rutas/App.tsx", "utf8").matchAll(/path="([a-z-]+)"/g)].map((m) => m[1]);

await prueba("humo", async ({ pagina, api }) => {
  comprobar(rutas.length >= 5, `${rutas.length} rutas encontradas en App.tsx`);
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
    await pagina.screenshot({ path: `${CAPTURAS}/humo-${ruta}.png` });
  }
});
