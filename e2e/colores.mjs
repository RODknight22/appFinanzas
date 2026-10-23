// Colores de ingreso y gasto: propios, distintos del acento (aunque el acento sea verde o rosa),
// en claro y en oscuro, también en el gráfico de flujo.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

/** Color calculado de un selector, o null si no hay ninguno en pantalla. */
function color(pagina, selector, propiedad = "color") {
  return pagina.evaluate(
    ([s, p]) => {
      const elemento = document.querySelector(s);
      return elemento ? getComputedStyle(elemento)[p] : null;
    },
    [selector, propiedad],
  );
}

await prueba("colores", async ({ pagina, api }) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const cuenta = await api.post("/cuentas", { nombre: "Banco", tipo: "debito", balance_inicial: "100" });
  const categorias = await api.get("/categorias");
  const sueldo = categorias.find((c) => c.tipo === "ingreso");
  const super_ = categorias.find((c) => c.tipo === "gasto");
  await api.post("/transacciones", { monto: "2000", tipo: "ingreso", fecha: hoy, cuenta_id: cuenta.id, categoria_id: sueldo.id });
  await api.post("/transacciones", { monto: "450", tipo: "gasto", fecha: hoy, cuenta_id: cuenta.id, categoria_id: super_.id });

  for (const modo of ["oscuro", "claro"]) {
    // El modo se recuerda en el navegador (useTema): se escribe y se recarga.
    await abrir(pagina, "/transacciones");
    await pagina.evaluate((m) => localStorage.setItem("tema", m), modo);
    await pagina.reload();
    await pagina.locator(".text-ingreso").first().waitFor();
    const ingreso = await color(pagina, ".text-ingreso");
    const gasto = await color(pagina, ".text-gasto");
    const acento = await color(pagina, ".bg-acento-600", "backgroundColor");
    comprobar(ingreso && gasto && ingreso !== gasto, `${modo}: ingreso y gasto con colores distintos (${ingreso} / ${gasto})`);
    comprobar(acento && ingreso !== acento, `${modo}: el ingreso no usa el verde del acento (${acento})`);
    await pagina.screenshot({ path: `${CAPTURAS}/colores-transacciones-${modo}.png` });

    await abrir(pagina, "/");
    const barra = pagina.locator(".recharts-bar-rectangle path").first();
    await barra.waitFor();
    const relleno = await barra.evaluate((e) => getComputedStyle(e).fill);
    comprobar(relleno === ingreso, `${modo}: el gráfico de flujo pinta los ingresos con su color (${relleno})`);
    await pagina.screenshot({ path: `${CAPTURAS}/colores-panel-${modo}.png`, fullPage: true });
  }

  // Con el acento rosa, el gasto sigue siendo su propio rojo.
  await api.patch("/configuracion", { color_acento: "rosa" });
  await abrir(pagina, "/transacciones");
  await pagina.locator(".text-gasto").first().waitFor();
  const gasto = await color(pagina, ".text-gasto");
  const rosa = await color(pagina, ".bg-acento-600", "backgroundColor");
  comprobar(gasto !== rosa, `con acento rosa, el gasto no usa el rosa del acento (${gasto} / ${rosa})`);
});
