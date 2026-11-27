// Edición en masa: marcar varias transacciones y cambiarles la cuenta, la categoría o borrarlas.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("edicion-masiva", async ({ pagina, api }) => {
  const bbva = await api.post("/cuentas", { nombre: "BBVA", tipo: "debito", balance_inicial: "0" });
  const revolut = await api.post("/cuentas", { nombre: "Revolut", tipo: "debito", balance_inicial: "0" });
  const categorias = await api.get("/categorias");
  const supermercado = categorias.find((c) => c.nombre === "Supermercado");
  const ocio = categorias.find((c) => c.tipo === "gasto" && c.id !== supermercado.id);
  const hoy = new Date().toISOString().slice(0, 10);
  // Importadas por error en BBVA: eran de Revolut.
  for (const [monto, notas] of [["10", "Cine"], ["20", "Cena"], ["30", "Concierto"]]) {
    await api.post("/transacciones", { monto, tipo: "gasto", fecha: hoy, notas, categoria_id: supermercado.id, cuenta_id: bbva.id });
  }

  await abrir(pagina, "/transacciones");
  await pagina.getByRole("button", { name: "Seleccionar", exact: true }).click();
  const contador = pagina.getByText(/\d+ de 3 seleccionadas$/);
  comprobar((await contador.textContent()) === "0 de 3 seleccionadas", "al entrar en el modo selección no hay nada marcado");
  await pagina.getByLabel("Seleccionar Cine del").check();
  const maestra = pagina.getByRole("checkbox", { name: "Seleccionar todo lo visible" });
  comprobar(await maestra.evaluate((c) => c.indeterminate), "con 1 de 3 marcadas, la casilla maestra queda a medias");
  await maestra.check();
  comprobar((await contador.textContent()) === "3 de 3 seleccionadas", "«Seleccionar todo lo visible» marca las 3");

  await pagina.getByRole("combobox", { name: "Cambiar cuenta" }).selectOption(String(revolut.id));
  await pagina.getByText("3 movimientos en Revolut").waitFor();
  const movidas = await api.get(`/transacciones?cuenta_id=${revolut.id}`);
  comprobar(movidas.length === 3, `las 3 pasan a Revolut (${movidas.length})`);
  comprobar((await contador.textContent()) === "0 de 3 seleccionadas", "tras el cambio la selección se vacía");

  await maestra.check();
  await pagina.getByRole("combobox", { name: "Cambiar categoría" }).selectOption(String(ocio.id));
  await pagina.getByText(`3 movimientos en ${ocio.nombre}`).waitFor();
  const recategorizadas = await api.get(`/transacciones?categoria_id=${ocio.id}`);
  comprobar(recategorizadas.length === 3, "las 3 cambian de categoría");

  // Móvil: la barra de acciones cabe sin scroll horizontal.
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.getByLabel("Seleccionar Cena del").check();
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `sin scroll horizontal en móvil (${ancho}px)`);
  await pagina.screenshot({ path: `${CAPTURAS}/edicion-masiva-movil.png` });

  // Eliminar pide confirmación con el diálogo de la app; cancelar no borra nada.
  await pagina.getByRole("button", { name: "Eliminar", exact: true }).click();
  const dialogo = pagina.getByRole("alertdialog");
  comprobar((await dialogo.textContent()).includes("¿Eliminar 1 transacción?"), "pide confirmar con el diálogo propio");
  await pagina.keyboard.press("Escape");
  await dialogo.waitFor({ state: "hidden" });
  comprobar((await api.get("/transacciones")).length === 3, "cancelar no borra nada");
  await pagina.getByRole("button", { name: "Eliminar", exact: true }).click();
  await dialogo.getByRole("button", { name: "Eliminar" }).click();
  await pagina.getByText("1 transacción eliminada").waitFor();
  const quedan = (await api.get("/transacciones")).map((t) => t.notas).sort();
  comprobar(quedan.join() === "Cine,Concierto", `se borra solo la marcada (${quedan})`);
});
