// Comparar vías de envío: transferencia al banco frente a sacar del cajero (a la cartera).
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("vias", async ({ pagina, api }) => {
  // Sin internet en las E2E: tasas a mano. 1 EUR = 20 MXN (la principal es MXN).
  await api.put("/tasas/USD", { en_principal: "18" });
  await api.put("/tasas/EUR", { en_principal: "20" });
  const hoy = new Date().toISOString().slice(0, 10);
  const revolut = await api.post("/cuentas", { nombre: "Revolut MX", tipo: "debito", balance_inicial: "20000" });
  const santander = await api.post("/cuentas", { nombre: "Santander", tipo: "debito", moneda: "EUR" });
  const cartera = await api.post("/cuentas", { nombre: "Cartera", tipo: "efectivo", moneda: "EUR" });
  const enviar = (destino, monto_destino) =>
    api.post("/transferencias", { cuenta_origen_id: revolut.id, cuenta_destino_id: destino.id, monto_origen: "2000", monto_destino, fecha: hoy });

  await abrir(pagina, "/cuentas");
  const titulo = pagina.getByText("¿Por dónde te sale más barato cambiar?");
  comprobar(!(await titulo.isVisible()), "sin envíos con lo que llegó, la tarjeta no aparece");

  // 2000 MXN = 100 EUR: por transferencia llegaron 97 (3 %), del cajero 99 (1 %).
  await enviar(santander, "97");
  await enviar(cartera, "99");
  await pagina.reload();
  await titulo.waitFor();
  const tarjeta = titulo.locator("xpath=ancestor::section[1]");
  const texto = (await tarjeta.innerText()).replace(/\s+/g, " ");
  comprobar(/más barato sacando efectivo a «Cartera»: 1\s?% frente a 3\s?%/.test(texto), `la conclusión dice cuál conviene (${texto.slice(0, 120)}…)`);
  const filas = tarjeta.locator("li");
  comprobar((await filas.first().innerText()).includes("La más barata"), "la más barata va primero y marcada");
  comprobar((await filas.count()) === 2, "una fila por vía");
  await tarjeta.screenshot({ path: `${CAPTURAS}/vias.png` });

  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.waitForTimeout(300);
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `sin scroll horizontal en móvil (${ancho}px)`);
  await tarjeta.screenshot({ path: `${CAPTURAS}/vias-movil.png` });
});
