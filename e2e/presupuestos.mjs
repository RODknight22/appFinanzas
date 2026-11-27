// Repetir presupuestos: copiar de un toque los del último mes que los tiene.
// Plan del mes: lo que entra de los fijos (el envío del papá), sin scroll horizontal en el móvil.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("presupuestos", async ({ pagina, api }) => {
  const hoy = new Date();
  const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const anterior = `${mesPasado.getFullYear()}-${String(mesPasado.getMonth() + 1).padStart(2, "0")}`;
  const gasto = (await api.get("/categorias")).filter((c) => c.tipo === "gasto");
  for (const [categoria, limite] of [[gasto[0], "300"], [gasto[1], "120"]]) {
    await api.post("/presupuestos", { categoria_id: categoria.id, mes_anio: anterior, monto_limite: limite });
  }

  // Ingresos fijos: uno hoy (pendiente este mes) y el del papá 10, 20 y 30 desde el mes que viene.
  const cuenta = await api.post("/cuentas", { nombre: "BBVA", tipo: "debito", balance_inicial: "0" });
  const ingreso = (await api.get("/categorias")).find((c) => c.tipo === "ingreso");
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const siguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 10);
  const fijo = { cuenta_id: cuenta.id, categoria_id: ingreso.id, monto: "5000" };
  await api.post("/ingresos-recurrentes", { ...fijo, nombre: "Nómina", periodicidad: "mensual", fecha_proximo_cobro: iso(hoy) });
  await api.post("/ingresos-recurrentes", {
    ...fijo, nombre: "Papá", periodicidad: "varias_al_mes", dias_de_cobro: [10, 20, 30], fecha_proximo_cobro: iso(siguiente),
  });
  const mesQueViene = iso(siguiente).slice(0, 7);
  const planSiguiente = await api.get(`/dashboard/plan-mes?mes_anio=${mesQueViene}`);
  comprobar(
    planSiguiente.ingresos_pendientes === "20000.00",
    `el plan del mes que viene prevé la nómina y los tres envíos del papá (${planSiguiente.ingresos_pendientes})`,
  );

  await pagina.setViewportSize({ width: 390, height: 844 });
  await abrir(pagina, "/presupuestos");
  await pagina.getByRole("heading", { name: "Plan del mes" }).waitFor();
  await pagina.getByText("Entra este mes").waitFor();
  comprobar(await pagina.getByText(/^Falta /).first().isVisible(), "la tarjeta del plan muestra lo que falta por cobrar este mes");
  const copiar = pagina.getByRole("button", { name: "Copiar 2 presupuestos" });
  await copiar.waitFor();
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `el plan del mes y el aviso para repetir el mes anterior caben en el móvil (${ancho}px)`);
  await pagina.screenshot({ path: `${CAPTURAS}/presupuestos-copiar.png` });

  await copiar.click();
  await copiar.waitFor({ state: "detached" });
  await pagina.getByText(gasto[1].nombre).first().waitFor();
  const actuales = await api.get(`/presupuestos?mes_anio=${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`);
  comprobar(actuales.length === 2, `«Copiar 2 presupuestos» repite los dos presupuestos y el aviso desaparece (${actuales.length})`);
});
