// Importar un extracto: categoría aprendida, duplicados, propagar la categoría y reimportar.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

// Estilo de un banco español: titular antes de la tabla, `;`, coma decimal, Windows-1252.
const EXTRACTO = Buffer.from(
  "Titular;RODRIGO\nCuenta;ES12 3456\n\n" +
  "F. Operación;F. Valor;Concepto;Importe;Saldo\n" +
  "02/10/2026;03/10/2026;COMPRA TARJ. 4567 MERCADONA VALENCIA;-45,20;954,80\n" +
  "03/10/2026;03/10/2026;COMPRA TARJ. 4567 MERCADONA VALENCIA;-18,35;936,45\n" +
  "03/10/2026;03/10/2026;MERCADONA MADRID;-12,00;924,45\n" +
  "04/10/2026;04/10/2026;Ferretería Pepe;-8,50;915,95\n" +
  "05/10/2026;05/10/2026;Ferretería Pepe;-3,10;912,85\n" +
  "06/10/2026;06/10/2026;NÓMINA ACME SL;2.000,00;2.912,85\n" +
  ";;Total;1.912,85;\n",
  "latin1",
);

async function subir(pagina) {
  await pagina.getByRole("button", { name: "Importar", exact: true }).click();
  await pagina.locator('input[type="file"]').setInputFiles({ name: "movimientos.csv", mimeType: "text/csv", buffer: EXTRACTO });
  await pagina.getByText("por importar").waitFor();
}

await prueba("importar", async ({ pagina, api }) => {
  const cuenta = await api.post("/cuentas", { nombre: "BBVA", tipo: "debito", balance_inicial: "1000" });
  const supermercado = (await api.get("/categorias")).find((c) => c.nombre === "Supermercado");
  // Historial: un Mercadona ya categorizado, y el gasto de 45,20 anotado a mano un día antes.
  for (const [monto, fecha, notas] of [["30", "2026-09-01", "COMPRA TARJ. 1111 MERCADONA VALENCIA"], ["45.20", "2026-10-01", "Súper"]]) {
    await api.post("/transacciones", { monto, tipo: "gasto", fecha, notas, categoria_id: supermercado.id, cuenta_id: cuenta.id });
  }

  await abrir(pagina, "/transacciones");
  await subir(pagina);
  const boton = pagina.getByRole("button", { name: /^Importar \d+ movimiento/ });
  comprobar((await boton.textContent()) === "Importar 5 movimientos", "5 nuevos (el de 45,20 ya estaba registrado)");

  // Elegir categoría en una fila la aplica a la otra con el mismo concepto.
  const progreso = pagina.getByRole("progressbar", { name: "Revisión" });
  const antes = Number(await progreso.getAttribute("aria-valuenow"));
  await pagina.locator("li", { hasText: "Ferretería Pepe" }).first().getByLabel("Categoría").selectOption({ label: "Vivienda" });
  await pagina.getByRole("status").getByText("Vivienda también en 1 movimiento igual").waitFor();
  comprobar(true, "un aviso cuenta las filas iguales que cambiaron solas");
  const despues = Number(await progreso.getAttribute("aria-valuenow"));
  comprobar(despues === antes + 2, `la barra de progreso avanza (${antes} → ${despues})`);
  comprobar(await pagina.getByLabel("Revisada").count() === 2, "las filas resueltas siguen a la vista con ✓");
  await pagina.screenshot({ path: `${CAPTURAS}/importar-revision.png` });
  await pagina.getByRole("button", { name: /^Todos/ }).click();
  const elegidas = await pagina.locator("li", { hasText: "Ferretería Pepe" }).getByLabel("Categoría")
    .evaluateAll((selects) => selects.map((s) => s.options[s.selectedIndex].text));
  comprobar(elegidas.join() === "Vivienda,Vivienda", "la categoría elegida se propaga al mismo concepto");

  await pagina.getByRole("button", { name: "Dar por buenas las sugerencias" }).click();
  await pagina.getByText("Todo revisado").waitFor();
  comprobar(true, "«Dar por buenas las sugerencias» termina la revisión de un toque");
  await pagina.screenshot({ path: `${CAPTURAS}/importar-vista-previa.png` });

  await boton.click();
  await pagina.getByText(/importados?$/).waitFor();
  const resumen = await api.get("/dashboard/resumen");
  const saldo = resumen.cuentas.find((c) => c.cuenta_id === cuenta.id).saldo;
  comprobar(saldo === "2882.85", `saldo final como el del banco más lo anotado (${saldo})`);
  await pagina.getByRole("button", { name: "Cerrar", exact: true }).last().click();

  // Reimportar el mismo archivo, en móvil: nada nuevo y sin scroll horizontal.
  await pagina.setViewportSize({ width: 390, height: 844 });
  await subir(pagina);
  const otraVez = await pagina.getByRole("button", { name: /^Importar \d+ movimiento/ }).textContent();
  comprobar(otraVez === "Importar 0 movimientos", "reimportar no duplica nada");
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `sin scroll horizontal en móvil (${ancho}px)`);
  await pagina.screenshot({ path: `${CAPTURAS}/importar-movil.png` });
});
