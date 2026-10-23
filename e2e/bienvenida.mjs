// Bienvenida: moneda, primera cuenta, sueldo opcional y recorrido con globos por el menú.
import { BASE, CAPTURAS, comprobar, prueba } from "./comun.mjs";

await prueba("bienvenida", async ({ pagina, api }) => {
  // Sin abrir() de comun.mjs: ese cierra la bienvenida, y aquí es lo que se prueba.
  await pagina.goto(`${BASE}/dashboard`);
  const ventana = pagina.getByRole("dialog", { name: "Primeros pasos" });
  await ventana.getByRole("button", { name: "Empezar" }).click();
  await ventana.getByRole("button", { name: "Siguiente" }).click(); // moneda: la propuesta

  await ventana.getByLabel("Nombre").fill("BBVA");
  await ventana.getByLabel("Saldo inicial").fill("1500");
  await ventana.getByRole("button", { name: "Guardar" }).click();

  await ventana.getByText("¿Cobras un sueldo fijo?").waitFor();
  await ventana.getByLabel("Cuánto, más o menos").fill("2000");
  await ventana.getByLabel("Qué día del mes").selectOption({ label: "Día 15" });
  await ventana.getByRole("button", { name: "Guardar y seguir" }).click();

  // Recorrido: un globo por apartado, a la derecha de su enlace en el menú lateral.
  const globo = pagina.getByRole("dialog", { name: "Dashboard" });
  await globo.waitFor();
  const [ingreso] = await api.get("/ingresos-recurrentes");
  comprobar(ingreso?.nombre === "Sueldo" && ingreso.dia_del_mes === 15 && ingreso.periodicidad === "mensual", "el sueldo queda como ingreso fijo mensual el día 15");
  await pagina.waitForTimeout(350); // fin de la transición del globo
  const enlace = await pagina.locator('aside [data-tutorial="/dashboard"]').boundingBox();
  const caja = await globo.boundingBox();
  comprobar(caja.x > enlace.x + enlace.width, "el primer globo señala el Dashboard desde la derecha");
  await pagina.screenshot({ path: `${CAPTURAS}/bienvenida-globo.png` });

  const actual = pagina.locator("#recorrido-titulo");
  const titulos = [await actual.textContent()];
  await pagina.keyboard.press("Enter"); // el foco está en «Siguiente»
  await pagina.getByRole("button", { name: "Atrás" }).click();
  comprobar((await actual.textContent()) === titulos[0], "«Atrás» vuelve al globo anterior");
  await pagina.keyboard.press("ArrowRight"); // y la flecha del teclado avanza
  for (let i = 0; i < 20 && !(await pagina.getByRole("button", { name: "¡Listo!" }).isVisible()); i++) {
    titulos.push(await actual.textContent());
    await pagina.keyboard.press("Enter");
  }
  titulos.push(await actual.textContent());
  comprobar(titulos.length === 9 && titulos.at(-1) === "Ajustes", `9 globos, de ${titulos[0]} a ${titulos.at(-1)}`);
  await pagina.getByRole("button", { name: "¡Listo!" }).click();
  await actual.waitFor({ state: "detached" });
  comprobar((await api.get("/configuracion")).tutorial_visto, "al terminar queda como visto");

  // Repetirlo desde Ajustes, en el móvil: los globos señalan la barra de abajo y caben en pantalla.
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.goto(`${BASE}/ajustes`);
  await pagina.getByRole("button", { name: "Ver el tutorial otra vez" }).click();
  await ventana.getByRole("button", { name: "Empezar" }).click();
  await ventana.getByRole("button", { name: "Siguiente" }).click();
  await ventana.getByText("Ya tienes 1 cuenta").waitFor();
  await ventana.getByRole("button", { name: "Siguiente" }).click();
  await ventana.getByText("Ya tienes ingresos fijos").waitFor();
  await ventana.getByRole("button", { name: "Siguiente" }).click();
  await globo.waitFor();
  let fuera = 0;
  for (let i = 0; i < 9; i++) {
    await pagina.waitForTimeout(350);
    const { x, y, width, height } = await pagina.locator("#recorrido-titulo").locator("..").boundingBox();
    if (x < 0 || y < 0 || x + width > 390 || y + height > 844) fuera++;
    if (i === 1) await pagina.screenshot({ path: `${CAPTURAS}/bienvenida-movil.png` });
    if (i < 8) await pagina.keyboard.press("ArrowRight");
  }
  comprobar(fuera === 0, "en el móvil los 9 globos caben en la pantalla");
  await pagina.keyboard.press("Escape");
  await pagina.locator("#recorrido-titulo").waitFor({ state: "detached" });
  comprobar(true, "Esc salta el recorrido");
});
