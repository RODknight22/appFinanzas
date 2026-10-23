// Ajustar el saldo: escribir lo que dice el banco (o lo contado en la cartera), que el saldo pase
// a ser ese, que el ajuste se pueda deshacer y que el diálogo quepa en el móvil.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

async function saldo(api, cuenta) {
  const resumen = await api.get("/dashboard/resumen");
  return resumen.cuentas.find((c) => c.cuenta_id === cuenta.id).saldo;
}

await prueba("ajuste-saldo", async ({ pagina, api }) => {
  const banco = await api.post("/cuentas", { nombre: "Santander", tipo: "debito", balance_inicial: "100" });
  const cartera = await api.post("/cuentas", { nombre: "Cartera", tipo: "efectivo", balance_inicial: "50" });

  await abrir(pagina, "/cuentas");
  await pagina.getByRole("button", { name: "Ajustar saldo de Santander" }).click();
  const dialogo = pagina.getByRole("dialog");
  const campo = dialogo.getByRole("spinbutton", { name: /lo que dice tu banco/ });
  comprobar((await campo.inputValue()) === "100.00", "el campo empieza con el saldo que lleva la app");
  await campo.fill("87.40");
  const diferencia = dialogo.getByText(/^Ajuste: −\$12\.60 al saldo$/);
  await diferencia.waitFor();
  comprobar(await diferencia.isVisible(), "muestra la diferencia antes de guardar");
  await pagina.screenshot({ path: `${CAPTURAS}/ajuste-saldo.png` });
  await dialogo.getByRole("button", { name: "Ajustar" }).click();
  await dialogo.waitFor({ state: "hidden" });
  comprobar((await saldo(api, banco)) === "87.40", "el saldo pasa a ser el escrito");

  // Deshacer desde el historial del mismo diálogo.
  await pagina.getByRole("button", { name: "Ajustar saldo de Santander" }).click();
  await dialogo.getByRole("button", { name: "Deshacer ajuste" }).click();
  await pagina.getByRole("button", { name: "Eliminar", exact: true }).click();
  await dialogo.getByText("Aún no has ajustado esta cuenta.").waitFor();
  comprobar((await saldo(api, banco)) === "100.00", "deshacer devuelve el saldo anterior");
  comprobar((await campo.inputValue()) === "100.00", "el diálogo sigue abierto y ve el saldo nuevo");
  await pagina.keyboard.press("Escape");

  // Efectivo: cuadrar con lo contado.
  await abrir(pagina, "/efectivo");
  await pagina.getByRole("button", { name: "Cuadrar con lo que hay" }).click();
  await dialogo.getByRole("spinbutton", { name: /lo que hay en la cartera/ }).fill("42");
  await dialogo.getByRole("button", { name: "Ajustar" }).click();
  await dialogo.waitFor({ state: "hidden" });
  comprobar((await saldo(api, cartera)) === "42.00", "la cartera queda con lo contado");

  await pagina.setViewportSize({ width: 390, height: 844 });
  await abrir(pagina, "/cuentas");
  await pagina.getByRole("button", { name: "Ajustar saldo de Santander" }).click();
  await dialogo.waitFor();
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `sin scroll horizontal en móvil (${ancho}px)`);
  await pagina.screenshot({ path: `${CAPTURAS}/ajuste-saldo-movil.png` });
});
