// Reglas al importar: se crean en Categorías y mandan sobre lo aprendido del historial.
import { BASE, CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("reglas", async ({ pagina, api }) => {
  await api.post("/cuentas", { nombre: "BBVA", tipo: "debito", balance_inicial: "1000" });

  await abrir(pagina, "/categorias");
  const reglas = pagina.locator("section", { hasText: "Reglas al importar" });
  await reglas.getByLabel("Texto que contiene el concepto").fill("mercadona");
  await reglas.getByLabel("Categoría de la regla").selectOption({ label: "Supermercado" });
  await reglas.getByRole("button", { name: "Añadir regla" }).click();
  await reglas.getByText("«mercadona»").waitFor();
  comprobar(true, "la regla aparece en Categorías");
  await pagina.setViewportSize({ width: 390, height: 844 });
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `la sección de reglas cabe en el móvil (${ancho}px)`);
  await reglas.screenshot({ path: `${CAPTURAS}/reglas-categorias.png` });
  await pagina.setViewportSize({ width: 1280, height: 900 });

  await pagina.goto(`${BASE}/transacciones`);
  await pagina.getByRole("button", { name: "Importar", exact: true }).click();
  const extracto = Buffer.from("Fecha;Concepto;Importe\n02/10/2026;COMPRA MERCADONA VALENCIA;-45,20\n");
  await pagina.locator('input[type="file"]').setInputFiles({ name: "banco.csv", mimeType: "text/csv", buffer: extracto });
  await pagina.getByText("por importar").waitFor();
  await pagina.getByRole("button", { name: /^Todos/ }).click();
  const elegida = await pagina.locator("li", { hasText: "MERCADONA" }).getByLabel("Categoría o transferencia")
    .evaluate((s) => s.options[s.selectedIndex].text);
  comprobar(elegida === "Supermercado", `la regla pone la categoría sin revisar nada (${elegida})`);

  // Borrar la regla desde Categorías.
  await pagina.getByRole("button", { name: "Cancelar" }).click();
  await abrir(pagina, "/categorias");
  await pagina.getByRole("button", { name: "Borrar la regla «mercadona»" }).click();
  await pagina.getByText("«mercadona»").waitFor({ state: "detached" });
  comprobar((await api.get("/reglas-categoria")).length === 0, "la regla se borra");
});
