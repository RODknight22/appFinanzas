// Fijos "varias veces al mes": el envío del papá (10, 20 y 30) y un pago fijo de un clic.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("fijos", async ({ pagina, api }) => {
  await api.post("/cuentas", { nombre: "BBVA", tipo: "debito", balance_inicial: "1000" });
  const categorias = await api.get("/categorias");
  const ingreso = categorias.find((c) => c.tipo === "ingreso");
  const gasto = categorias.find((c) => c.tipo === "gasto");

  // --- Ingreso fijo: 5000 MXN los días 10, 20 y 30, en el móvil -------------
  await pagina.setViewportSize({ width: 390, height: 844 });
  await abrir(pagina, "/pagos-fijos/ingresos");
  await pagina.getByRole("button", { name: "Añadir el primero" }).click();
  await pagina.getByLabel("Nombre").fill("Papá");
  await pagina.getByLabel("Monto habitual").fill("5000");
  await pagina.getByLabel("Periodicidad").selectOption("varias_al_mes");
  for (const dia of [30, 10, 20]) await pagina.getByRole("button", { name: `Día ${dia}`, exact: true }).click();
  await pagina.getByLabel("Categoría").selectOption({ label: ingreso.nombre });
  const pulsado = await pagina.getByRole("button", { name: "Día 20", exact: true }).getAttribute("aria-pressed");
  comprobar(pulsado === "true", "los días elegidos quedan marcados (aria-pressed)");
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `el selector de días cabe en el móvil (${ancho}px)`);
  await pagina.screenshot({ path: `${CAPTURAS}/fijos-selector-dias.png` });
  await pagina.getByRole("button", { name: "Guardar" }).click();

  const descripcion = pagina.getByText(/Los días 10, 20 y 30/);
  await descripcion.first().waitFor();
  const [papa] = await api.get("/ingresos-recurrentes");
  comprobar(
    papa.periodicidad === "varias_al_mes" && papa.dias_de_cobro.join(",") === "10,20,30",
    `se guarda «varias al mes» con los días ordenados (${papa.dias_de_cobro})`,
  );
  comprobar((await descripcion.count()) > 0, "la lista dice «Los días 10, 20 y 30»");
  const estimado = await pagina.getByText(/^Ingreso mensual estimado/).textContent();
  comprobar(/15[.,\s]?000/.test(estimado), `el estimado mensual cuenta tres envíos (${estimado.trim()})`);

  // --- Pago fijo con calendario y cuenta/categoría por defecto --------------
  await pagina.setViewportSize({ width: 1280, height: 900 });
  await abrir(pagina, "/pagos-fijos");
  await pagina.getByRole("button", { name: "Añadir la primera" }).click();
  await pagina.getByLabel("Nombre").fill("Clases");
  await pagina.getByLabel("Monto", { exact: true }).fill("40");
  await pagina.getByLabel("Periodicidad").selectOption("varias_al_mes");
  for (const dia of [5, 15, 30]) await pagina.getByRole("button", { name: `Día ${dia}`, exact: true }).click();
  await pagina.getByLabel("Cuenta de cargo").selectOption({ label: "BBVA" });
  await pagina.getByLabel("Categoría").selectOption({ label: gasto.nombre });
  await pagina.getByRole("button", { name: "Guardar" }).click();
  await pagina.getByText("Los días 5, 15 y 30").first().waitFor();

  // "Pagado" abre el pago ya relleno: basta con confirmar.
  const [antes] = await api.get("/suscripciones");
  await pagina.getByRole("button", { name: "Pagado" }).click();
  await pagina.getByRole("button", { name: "Registrar pago" }).click();
  await pagina.getByRole("button", { name: "Registrar pago" }).waitFor({ state: "detached" });
  const [despues] = await api.get("/suscripciones");
  const nueva = new Date(`${despues.fecha_proximo_pago}T00:00:00`);
  const ultimoDelMes = new Date(nueva.getFullYear(), nueva.getMonth() + 1, 0).getDate();
  comprobar(
    despues.fecha_proximo_pago > antes.fecha_proximo_pago && [5, 15, 30, ultimoDelMes].includes(nueva.getDate()),
    `el pago avanza al siguiente de sus días (${antes.fecha_proximo_pago} → ${despues.fecha_proximo_pago})`,
  );
  const gastos = await api.get("/transacciones?tipo=gasto");
  comprobar(
    gastos.some((t) => t.categoria_id === gasto.id && Number(t.monto) === 40),
    "se anota el gasto con la cuenta y categoría guardadas",
  );
  await pagina.screenshot({ path: `${CAPTURAS}/fijos-pagos.png` });
});
