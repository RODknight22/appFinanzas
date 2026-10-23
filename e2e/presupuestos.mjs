// Repetir presupuestos: copiar de un toque los del último mes que los tiene.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("presupuestos", async ({ pagina, api }) => {
  const hoy = new Date();
  const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const anterior = `${mesPasado.getFullYear()}-${String(mesPasado.getMonth() + 1).padStart(2, "0")}`;
  const gasto = (await api.get("/categorias")).filter((c) => c.tipo === "gasto");
  for (const [categoria, limite] of [[gasto[0], "300"], [gasto[1], "120"]]) {
    await api.post("/presupuestos", { categoria_id: categoria.id, mes_anio: anterior, monto_limite: limite });
  }

  await pagina.setViewportSize({ width: 390, height: 844 });
  await abrir(pagina, "/presupuestos");
  const copiar = pagina.getByRole("button", { name: "Copiar 2" });
  await copiar.waitFor();
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `el aviso para repetir el mes anterior cabe en el móvil (${ancho}px)`);
  await pagina.screenshot({ path: `${CAPTURAS}/presupuestos-copiar.png` });

  await copiar.click();
  await copiar.waitFor({ state: "detached" });
  await pagina.getByText(gasto[1].nombre).first().waitFor();
  const actuales = await api.get(`/presupuestos?mes_anio=${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`);
  comprobar(actuales.length === 2, `«Copiar 2» repite los dos presupuestos y el aviso desaparece (${actuales.length})`);
});
