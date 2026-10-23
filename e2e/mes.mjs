// Selector de mes: "Hoy" vuelve al mes en curso y la cuadrícula salta a cualquier mes y año.
import { BASE, CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("mes", async ({ pagina, api }) => {
  await abrir(pagina, "/dashboard");
  const selector = pagina.getByRole("button", { name: /elegir otro mes$/ });
  const hoy = pagina.getByRole("button", { name: "Volver al mes actual" });
  const nombreMes = async () => (await selector.textContent()).trim();
  const mesEnCurso = await nombreMes();
  const anio = Number(mesEnCurso.match(/\d{4}/)[0]);
  comprobar((await hoy.count()) === 0, `en el mes en curso (${mesEnCurso}) no hay botón "Hoy"`);

  await pagina.getByRole("button", { name: "Mes anterior" }).click();
  await pagina.getByRole("button", { name: "Mes anterior" }).click();
  await hoy.waitFor();
  comprobar((await nombreMes()) !== mesEnCurso, `dos meses atrás aparece "Hoy" (${await nombreMes()})`);
  await hoy.click();
  await hoy.waitFor({ state: "detached" });
  comprobar((await nombreMes()) === mesEnCurso, "\"Hoy\" vuelve al mes en curso y desaparece");

  // Cuadrícula: un año atrás y enero, en dos toques y sin pasar mes a mes.
  await selector.click();
  const panel = pagina.getByRole("dialog", { name: "Elegir mes" });
  await panel.waitFor();
  const enfocado = await pagina.evaluate(() => document.activeElement?.getAttribute("aria-pressed"));
  comprobar(enfocado === "true", "al abrir, el foco está en el mes elegido");
  await panel.getByRole("button", { name: "Año anterior" }).click();
  await panel.locator("button[aria-pressed]").first().click();
  await panel.waitFor({ state: "detached" });
  const salto = await nombreMes();
  comprobar(salto.includes(String(anio - 1)) && salto !== mesEnCurso, `salta a enero del año anterior (${salto})`);
  await pagina.screenshot({ path: `${CAPTURAS}/mes-salto.png` });

  // Esc cierra sin cambiar nada y devuelve el foco al selector.
  await selector.click();
  await panel.waitFor();
  await pagina.keyboard.press("Escape");
  await panel.waitFor({ state: "detached" });
  const foco = await pagina.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
  comprobar((await nombreMes()) === salto && foco.endsWith("elegir otro mes"), "Esc cierra sin cambiar el mes");

  // Presupuestos usa el mismo selector.
  await pagina.goto(`${BASE}/presupuestos`);
  const enPresupuestos = await selector.waitFor().then(() => true, () => false);
  comprobar(enPresupuestos && (await hoy.count()) === 0, "Presupuestos usa el mismo selector, en el mes en curso");

  // El calendario de fechas comparte con este panel cómo se coloca y se cierra.
  await api.post("/cuentas", { nombre: "BBVA", tipo: "debito", balance_inicial: "1000" });
  await abrir(pagina, "/transacciones");
  await pagina.getByRole("button", { name: "Nueva", exact: true }).click();
  await pagina.getByRole("button", { name: /^Hoy · BBVA/ }).click();
  await pagina.getByRole("dialog").getByRole("button", { name: /^Fecha / }).click();
  const calendario = pagina.getByRole("dialog", { name: "Elegir fecha" });
  await calendario.getByRole("button", { name: "Ayer" }).click();
  await calendario.waitFor({ state: "detached" });
  const fecha = await pagina.getByRole("dialog").getByRole("button", { name: /^Fecha / }).textContent();
  comprobar(fecha.startsWith("Ayer"), `el calendario de fechas sigue funcionando (${fecha})`);

  // Móvil: el panel cabe en la pantalla y la página no se desplaza a lo ancho.
  await pagina.setViewportSize({ width: 390, height: 844 });
  await abrir(pagina, "/dashboard");
  await pagina.getByRole("button", { name: "Mes anterior" }).click();
  await selector.click();
  await panel.waitFor();
  await pagina.waitForTimeout(300); // que termine la animación de entrada antes de la captura
  const caja = await panel.boundingBox();
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(caja.x >= 0 && caja.x + caja.width <= 390 && ancho <= 390, `en móvil cabe (${Math.round(caja.x + caja.width)}px, página ${ancho}px)`);
  await pagina.screenshot({ path: `${CAPTURAS}/mes-movil.png` });
});
