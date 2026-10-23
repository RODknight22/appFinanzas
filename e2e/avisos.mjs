// Avisos propios: el diálogo de confirmar (cancelar con Esc, aceptar con clic o Intro; al
// borrar, el foco empieza en «Cancelar») y los toasts de error, en un móvil de 390 px.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("avisos", async ({ pagina, api, errores }) => {
  await pagina.setViewportSize({ width: 390, height: 844 });
  const madre = await api.post("/cuentas", { nombre: "Revolut", tipo: "debito", balance_inicial: "100" });
  await api.post("/cuentas", { nombre: "Bolsillo", tipo: "debito", balance_inicial: "50", cuenta_padre_id: madre.id });
  await api.post("/cuentas", { nombre: "Cuenta vieja", tipo: "debito", balance_inicial: "0" });
  // Una cuenta con movimientos: el backend no deja borrarla (409).
  const usada = await api.post("/cuentas", { nombre: "Nómina", tipo: "debito", balance_inicial: "0" });
  const gasto = (await api.get("/categorias")).find((c) => c.tipo === "gasto");
  await api.post("/transacciones", {
    monto: "10", tipo: "gasto", fecha: new Date().toISOString().slice(0, 10), categoria_id: gasto.id, cuenta_id: usada.id,
  });

  await abrir(pagina, "/cuentas");
  // La fila de una cuenta (sin la lista de subcuentas que la rodea) y su botón de eliminar.
  const fila = (nombre, otra) => pagina.locator("li", { hasText: nombre, hasNotText: otra });
  const vieja = fila("Cuenta vieja", "Revolut");
  await vieja.waitFor();
  const dialogo = pagina.getByRole("alertdialog");

  // 1. Cancelar con Esc: la cuenta sigue ahí y el foco vuelve al botón que abrió el diálogo.
  const eliminarVieja = vieja.getByRole("button", { name: "Eliminar" });
  await eliminarVieja.click();
  await dialogo.waitFor();
  comprobar((await dialogo.textContent()).includes("¿Eliminar la cuenta «Cuenta vieja»?"), "sale el diálogo propio con la pregunta");
  await pagina.waitForTimeout(400); // que termine la animación de entrada
  await pagina.screenshot({ path: `${CAPTURAS}/avisos-dialogo.png` });
  await pagina.keyboard.press("Escape");
  await dialogo.waitFor({ state: "hidden" });
  comprobar(await vieja.isVisible(), "Esc cancela: la cuenta no se borra");
  comprobar(await eliminarVieja.evaluate((b) => b === document.activeElement), "el foco vuelve al botón de eliminar");

  // 2. Confirmar con clic en el botón del diálogo: la cuenta desaparece.
  await eliminarVieja.click();
  await dialogo.getByRole("button", { name: "Eliminar" }).click();
  await vieja.waitFor({ state: "detached" });
  comprobar(true, "al confirmar en el diálogo la cuenta se borra");

  // 3. Una cuenta con subcuentas no se puede borrar: el botón ya lo dice, sin esperar al error.
  const eliminarMadre = fila("Revolut", "Bolsillo").getByRole("button", { name: "Eliminar Revolut" });
  comprobar(
    (await eliminarMadre.getAttribute("aria-disabled")) === "true" && (await eliminarMadre.getAttribute("title")).includes("subcuentas"),
    "la cuenta con subcuentas tiene el borrado apagado y explica por qué",
  );

  // 4. Al borrar, el foco empieza en «Cancelar»: un Intro por inercia no borra nada.
  const eliminarUsada = fila("Nómina", "Revolut").getByRole("button", { name: "Eliminar" });
  await eliminarUsada.click();
  await dialogo.waitFor();
  const cancelar = dialogo.getByRole("button", { name: "Cancelar" });
  comprobar(await cancelar.evaluate((b) => b === document.activeElement), "en un borrado el foco empieza en Cancelar");
  await pagina.keyboard.press("Enter");
  await dialogo.waitFor({ state: "hidden" });
  comprobar(await fila("Nómina", "Revolut").isVisible(), "Intro sobre Cancelar no borra");

  // 5. Un error del backend (tiene movimientos) sale como toast; se confirma con Tab + Intro.
  await eliminarUsada.click();
  await dialogo.waitFor();
  await pagina.keyboard.press("Tab");
  await pagina.keyboard.press("Enter");
  const toast = pagina.getByRole("alert").filter({ hasText: "transacciones" });
  await toast.waitFor();
  comprobar(await fila("Nómina", "Revolut").isVisible(), "Tab + Intro confirma, pero la cuenta con movimientos no se borra");
  comprobar(true, "el error sale en un aviso propio (role=alert)");
  // El navegador apunta en la consola el 409 que hemos provocado a propósito: no es un fallo.
  const provocado = errores.findIndex((e) => e.includes("409"));
  if (provocado !== -1) errores.splice(provocado, 1);

  // 6. Cabe en 390 px: el aviso dentro de la pantalla y sin scroll horizontal.
  const caja = await toast.boundingBox();
  comprobar(caja.x >= 0 && caja.x + caja.width <= 390, `el aviso cabe a 390 px (x=${caja.x}, ancho=${caja.width})`);
  const anchoPagina = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(anchoPagina <= 390, `sin scroll horizontal (ancho ${anchoPagina})`);
  comprobar(caja.y + caja.height <= (await pagina.getByRole("navigation").last().boundingBox()).y, "el aviso no tapa la barra de abajo");
  await pagina.waitForTimeout(400); // que termine la animación de entrada
  await pagina.screenshot({ path: `${CAPTURAS}/avisos-error.png` });

  await toast.getByRole("button", { name: "Cerrar aviso" }).click();
  await toast.waitFor({ state: "detached" });
  comprobar(true, "el aviso se cierra con su botón");
});
