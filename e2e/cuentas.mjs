// Cuentas: plegar y desplegar las subcuentas, que el navegador lo recuerde y que la flecha (a la
// izquierda) no descuadre los nombres, en escritorio y en móvil.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

/** Los nombres de una cuenta con subcuentas y otra sin ellas empiezan en la misma columna. */
async function nombresAlineados(pagina) {
  const conSubcuentas = await pagina.getByText("Revolut", { exact: true }).boundingBox();
  const sinSubcuentas = await pagina.getByText("Santander", { exact: true }).boundingBox();
  return Math.abs(conSubcuentas.x - sinSubcuentas.x) < 1;
}

await prueba("cuentas", async ({ pagina, api }) => {
  await api.post("/cuentas", { nombre: "Santander", tipo: "debito", balance_inicial: "20" });
  const madre = await api.post("/cuentas", { nombre: "Revolut", tipo: "debito", balance_inicial: "100" });
  for (const nombre of ["Bolsillo viajes", "Bolsillo ahorro"]) {
    await api.post("/cuentas", { nombre, tipo: "debito", balance_inicial: "50", cuenta_padre_id: madre.id });
  }

  await abrir(pagina, "/cuentas");
  const subcuenta = pagina.getByText("Bolsillo viajes");
  await subcuenta.waitFor();
  comprobar(await subcuenta.isVisible(), "las subcuentas se ven desplegadas por defecto");
  comprobar(await nombresAlineados(pagina), "el nombre con y sin subcuentas queda alineado");

  const ocultar = pagina.getByRole("button", { name: "Ocultar 2 subcuentas" });
  const flecha = await ocultar.boundingBox();
  const nombre = await pagina.getByText("Revolut", { exact: true }).boundingBox();
  comprobar(flecha.x < nombre.x, "la flecha está a la izquierda del nombre");
  comprobar((await ocultar.getAttribute("aria-expanded")) === "true", "aria-expanded dice que está desplegada");

  await ocultar.click();
  comprobar(!(await subcuenta.isVisible()), "la flecha pliega las subcuentas");
  const mostrar = pagina.getByRole("button", { name: "Mostrar 2 subcuentas" });
  comprobar((await mostrar.getAttribute("aria-expanded")) === "false", "aria-expanded dice que está plegada");
  comprobar((await mostrar.innerText()).trim() === "2", "plegada muestra cuántas subcuentas oculta");
  await pagina.waitForTimeout(300); // que termine el giro de la flecha
  await pagina.screenshot({ path: `${CAPTURAS}/cuentas-plegadas.png` });

  await pagina.reload();
  await pagina.getByText("Revolut").first().waitFor();
  comprobar(!(await subcuenta.isVisible()), "al recargar siguen plegadas");

  await mostrar.click();
  comprobar(await subcuenta.isVisible(), "la flecha las vuelve a mostrar");
  await pagina.waitForTimeout(300); // que termine el giro de la flecha
  await pagina.screenshot({ path: `${CAPTURAS}/cuentas-desplegadas.png` });

  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.waitForTimeout(300);
  comprobar(await nombresAlineados(pagina), "en móvil los nombres siguen alineados");
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `sin scroll horizontal en móvil (${ancho}px)`);
  await pagina.screenshot({ path: `${CAPTURAS}/cuentas-movil.png` });
});
