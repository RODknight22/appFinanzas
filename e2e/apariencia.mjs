// Apariencia: estilo visual y color de acento se aplican al momento y se recuerdan.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("apariencia", async ({ pagina, api }) => {
  const html = pagina.locator("html");
  const fondo = () => pagina.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // Con el fundido, el cambio llega un fotograma después del clic: hay que esperarlo.
  async function esperarAtributo(nombre, valor, mensaje) {
    const llego = await pagina
      .waitForFunction(([n, v]) => document.documentElement.getAttribute(n) === v, [nombre, valor], { timeout: 3000 })
      .then(() => true, () => false);
    comprobar(llego, `${mensaje} (${nombre}=${await html.getAttribute(nombre)})`);
  }

  await abrir(pagina, "/ajustes/apariencia");
  const fondoInicial = await fondo();
  await pagina.getByRole("button", { name: /Medianoche/ }).click();
  // Se espera la respuesta desde antes del clic: si no, podría llegar antes de escucharla.
  const guardado = pagina.waitForResponse((r) => r.url().endsWith("/api/configuracion") && r.request().method() === "PATCH");
  await pagina.getByRole("button", { name: "Lima" }).click();
  await esperarAtributo("data-estilo", "medianoche", "el estilo se aplica al momento");
  await esperarAtributo("data-acento", "lima", "el acento nuevo se aplica al momento");
  comprobar((await fondo()) !== fondoInicial, "el fondo cambia de color con el estilo");
  await pagina.screenshot({ path: `${CAPTURAS}/apariencia-medianoche.png` });

  // Se guarda en el backend y, al recargar, se pinta antes de que arranque React.
  await guardado;
  const configuracion = await api.get("/configuracion");
  comprobar(configuracion.estilo_visual === "medianoche" && configuracion.color_acento === "lima", "se guarda en el backend");
  await pagina.reload();
  await esperarAtributo("data-estilo", "medianoche", "al recargar se mantiene el estilo");

  // Arena en modo claro: el estilo "con carácter" para el día.
  await pagina.getByRole("button", { name: /Arena/ }).click();
  await pagina.getByRole("button", { name: "Modo claro" }).click();
  const claro = await pagina
    .waitForFunction(() => !document.documentElement.classList.contains("dark"), null, { timeout: 3000 })
    .then(() => true, () => false);
  comprobar(claro, "cambia a modo claro");
  await pagina.screenshot({ path: `${CAPTURAS}/apariencia-arena-claro.png` });

  await pagina.setViewportSize({ width: 390, height: 844 });
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `sin scroll horizontal en móvil (${ancho}px)`);
  await pagina.screenshot({ path: `${CAPTURAS}/apariencia-movil.png`, fullPage: true });
});
