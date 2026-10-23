// Secciones con pestañas: Metas | Deseos, Pagos fijos (Suscripciones | Ingresos fijos) y Ajustes.
import { BASE, CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("secciones", async ({ pagina }) => {
  // Las direcciones antiguas (avisos, marcadores) llevan a su nueva pestaña.
  for (const [antigua, nueva] of [["/deseos", "/metas/deseos"], ["/suscripciones", "/pagos-fijos"], ["/ingresos", "/pagos-fijos/ingresos"]]) {
    await abrir(pagina, antigua);
    await pagina.waitForURL(`${BASE}${nueva}`);
    comprobar(true, `${antigua} lleva a ${nueva}`);
  }

  await abrir(pagina, "/metas");
  await pagina.getByRole("navigation", { name: "Secciones de metas" }).getByRole("link", { name: "Deseos" }).click();
  await pagina.waitForURL(`${BASE}/metas/deseos`);
  // waitFor: la página de deseos se descarga la primera vez que se visita.
  const aparecio = await pagina.getByRole("heading", { name: "Lista de deseos" }).first().waitFor().then(() => true, () => false);
  comprobar(aparecio, "la pestaña Deseos abre la lista de deseos");
  await pagina.screenshot({ path: `${CAPTURAS}/secciones-deseos.png` });

  await abrir(pagina, "/pagos-fijos");
  await pagina.getByRole("navigation", { name: "Secciones de pagos fijos" }).getByRole("link", { name: "Ingresos fijos" }).click();
  await pagina.waitForURL(`${BASE}/pagos-fijos/ingresos`);
  const menu = pagina.getByRole("link", { name: "Pagos fijos" }).first();
  comprobar((await menu.getAttribute("aria-current")) === "page", "el menú marca Pagos fijos también en la pestaña de ingresos");

  await pagina.setViewportSize({ width: 390, height: 844 });
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `sin scroll horizontal en móvil (${ancho}px)`);
  await pagina.screenshot({ path: `${CAPTURAS}/secciones-movil.png` });

  // Ajustes: cada pestaña es una ruta con su título y cabe en el móvil sin scroll lateral.
  const ajustes = [
    ["Perfil", "/ajustes", "Perfil"],
    ["Apariencia", "/ajustes/apariencia", "Apariencia"],
    ["Monedas", "/ajustes/monedas", "Monedas"],
    ["Seguridad y datos", "/ajustes/seguridad", "Seguridad y datos"],
  ];
  await abrir(pagina, "/ajustes/seguridad");
  for (const [pestana, ruta, titulo] of ajustes) {
    await pagina.getByRole("navigation", { name: "Secciones de ajustes" }).getByRole("link", { name: pestana }).click();
    await pagina.waitForURL(`${BASE}${ruta}`);
    const visible = await pagina.getByRole("heading", { level: 1, name: titulo }).waitFor().then(() => true, () => false);
    const anchoAjustes = await pagina.evaluate(() => document.documentElement.scrollWidth);
    comprobar(visible && anchoAjustes <= 390, `Ajustes › ${pestana}: abre en ${ruta}, sin scroll lateral (${anchoAjustes}px)`);
    await pagina.screenshot({ path: `${CAPTURAS}/ajustes-${ruta.split("/").pop()}-movil.png`, fullPage: true });
  }
});
