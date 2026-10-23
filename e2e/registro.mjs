// Anotar movimientos en dos toques: importe + categoría, varios seguidos y deshacer el último.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("registro", async ({ pagina, api }) => {
  // Sin ninguna recordada se propone la primera de la lista (BBVA).
  const bbva = await api.post("/cuentas", { nombre: "BBVA", tipo: "debito", balance_inicial: "1000" });
  await api.post("/cuentas", { nombre: "Revolut", tipo: "debito", balance_inicial: "0" });
  // Historial: Restaurantes es la más usada, así que debe salir la primera.
  const restaurantes = (await api.get("/categorias")).find((c) => c.nombre === "Restaurantes");
  for (const fecha of ["2026-09-01", "2026-09-02"]) {
    await api.post("/transacciones", { monto: "10", tipo: "gasto", fecha, categoria_id: restaurantes.id, cuenta_id: bbva.id });
  }

  await abrir(pagina, "/transacciones");
  await pagina.getByRole("button", { name: "Nueva", exact: true }).click();
  const rejilla = pagina.getByRole("dialog").getByText("Toca la categoría para guardar").locator("..");
  // La rejilla sale en orden de creación y se reordena al llegar los últimos movimientos:
  // se espera a ese reordenamiento (en el CI, más lento, aún no ha llegado al pintar).
  const primeraEsRestaurantes = await rejilla.getByRole("button").first()
    .filter({ hasText: /^Restaurantes$/ }).waitFor({ timeout: 5000 }).then(() => true, () => false);
  comprobar(primeraEsRestaurantes, "la categoría más usada sale la primera");

  // Cambiar de cuenta en las opciones plegadas; la siguiente vez debe proponerse sola.
  await pagina.getByRole("button", { name: /^Hoy · BBVA/ }).click();
  await pagina.getByRole("dialog").getByRole("combobox", { name: /^Cuenta/ }).selectOption({ label: "Revolut" });

  const importe = pagina.getByRole("dialog").getByLabel("Importe", { exact: true });
  await importe.fill("12.50");
  await rejilla.getByRole("button", { name: "Supermercado" }).click();
  await pagina.getByRole("status").getByText("Supermercado").waitFor();
  comprobar((await importe.inputValue()) === "", "tras guardar, el importe queda vacío para el siguiente");

  await importe.fill("3");
  await pagina.getByRole("dialog").getByLabel("Nota (opcional)").fill("café");
  await rejilla.getByRole("button", { name: "Restaurantes" }).click();
  await pagina.getByRole("button", { name: "Listo · 2 anotados" }).waitFor();
  comprobar(true, "dos movimientos seguidos sin cerrar la ventana");
  await pagina.screenshot({ path: `${CAPTURAS}/registro-rapido.png` });

  await pagina.getByRole("button", { name: "Deshacer" }).click();
  await pagina.getByRole("button", { name: "Listo · 1 anotado" }).waitFor();
  const guardadas = (await api.get("/transacciones?limit=10")).filter((t) => t.cuenta_id !== bbva.id);
  comprobar(guardadas.length === 1 && guardadas[0].monto === "12.50", "«Deshacer» borra solo el último");

  // Sin importe no se guarda nada: el navegador pide el dato.
  await rejilla.getByRole("button", { name: "Ropa" }).click();
  comprobar((await api.get("/transacciones?limit=10")).length === 3, "sin importe, tocar una categoría no guarda");

  await pagina.getByRole("button", { name: "Listo · 1 anotado" }).click();
  await pagina.getByRole("dialog").waitFor({ state: "detached" });
  comprobar(await pagina.getByText(/12[.,]50/).first().isVisible(), "la lista ya muestra lo anotado");

  // En móvil: la última cuenta usada se recuerda y no hay scroll horizontal.
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.getByRole("button", { name: "Nueva", exact: true }).click();
  comprobar(await pagina.getByRole("button", { name: /^Hoy · Revolut/ }).isVisible(), "propone la última cuenta usada");
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `sin scroll horizontal en móvil (${ancho}px)`);
  await pagina.screenshot({ path: `${CAPTURAS}/registro-movil.png` });
});
