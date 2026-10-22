// Cuentas: plegar y desplegar las subcuentas, y que el navegador lo recuerde.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("cuentas", async ({ pagina, api }) => {
  const madre = await api.post("/cuentas", { nombre: "Revolut", tipo: "debito", balance_inicial: "100" });
  for (const nombre of ["Bolsillo viajes", "Bolsillo ahorro"]) {
    await api.post("/cuentas", { nombre, tipo: "debito", balance_inicial: "50", cuenta_padre_id: madre.id });
  }

  await abrir(pagina, "/cuentas");
  const subcuenta = pagina.getByText("Bolsillo viajes");
  await subcuenta.waitFor();
  comprobar(await subcuenta.isVisible(), "las subcuentas se ven desplegadas por defecto");

  await pagina.getByRole("button", { name: "Ocultar 2 subcuentas" }).click();
  comprobar(!(await subcuenta.isVisible()), "la flecha pliega las subcuentas");
  await pagina.waitForTimeout(300); // que termine el giro de la flecha
  await pagina.screenshot({ path: `${CAPTURAS}/cuentas-plegadas.png` });

  await pagina.reload();
  await pagina.getByText("Revolut").first().waitFor();
  comprobar(!(await subcuenta.isVisible()), "al recargar siguen plegadas");

  await pagina.getByRole("button", { name: "Mostrar 2 subcuentas" }).click();
  comprobar(await subcuenta.isVisible(), "la flecha las vuelve a mostrar");
  await pagina.waitForTimeout(300); // que termine el giro de la flecha
  await pagina.screenshot({ path: `${CAPTURAS}/cuentas-desplegadas.png` });
});
