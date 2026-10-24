// Navegación en el móvil: barra de abajo con los mismos nombres que el menú de escritorio y un
// botón «Más» con el resto de apartados, Ajustes, el modo y salir.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("navegacion-movil", async ({ pagina }) => {
  await pagina.setViewportSize({ width: 360, height: 780 }); // de los móviles más estrechos
  await abrir(pagina, "/dashboard");
  const barra = pagina.locator("nav.fixed");
  const nombres = (await barra.locator(":scope > *").allInnerTexts()).map((t) => t.trim());
  comprobar(
    nombres.join(",") === "Dashboard,Transacciones,Presupuestos,Cuentas,Más",
    `la barra usa los nombres del escritorio (${nombres.join(", ")})`,
  );
  const cortados = await barra.locator("span").evaluateAll((spans) => spans.filter((s) => s.scrollWidth > s.clientWidth).length);
  comprobar(cortados === 0, "ningún nombre de la barra se corta a 360 px");

  const mas = barra.getByRole("button", { name: "Más" });
  await mas.click();
  const panel = pagina.getByRole("dialog", { name: "Más apartados" });
  await panel.waitFor();
  for (const nombre of ["Metas", "Deudas", "Pagos fijos", "Categorías", "Ajustes", "Modo claro"]) {
    comprobar(await panel.getByText(nombre, { exact: true }).isVisible(), `«Más» incluye ${nombre}`);
  }
  await pagina.waitForTimeout(400); // fin de la animación de entrada
  await pagina.screenshot({ path: `${CAPTURAS}/navegacion-movil-mas.png` });

  await panel.getByRole("link", { name: "Deudas" }).click();
  await pagina.waitForURL(/\/deudas$/);
  await panel.waitFor({ state: "detached" });
  comprobar(true, "al elegir un apartado se abre y el panel se cierra");
  const color = (el) => el.evaluate((e) => getComputedStyle(e).color);
  comprobar(
    (await color(mas)) !== (await color(barra.getByRole("link", { name: "Dashboard" }))),
    "en una página de «Más», el botón «Más» queda marcado",
  );

  await mas.click();
  await panel.waitFor();
  await pagina.keyboard.press("Escape");
  await panel.waitFor({ state: "detached" });
  comprobar(true, "Esc cierra el panel");

  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 360, `sin scroll horizontal (${ancho}px)`);
  await pagina.screenshot({ path: `${CAPTURAS}/navegacion-movil.png` });
});
