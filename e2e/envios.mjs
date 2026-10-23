// Coste de los envíos entre monedas (lista y widget) y el widget de poder adquisitivo.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

await prueba("envios", async ({ pagina, api }) => {
  // Sin internet en las E2E: tasas a mano (la principal es MXN). Primero el USD, que fija
  // la del peso; después 1 EUR = 20 MXN.
  await api.put("/tasas/USD", { en_principal: "18" });
  await api.put("/tasas/EUR", { en_principal: "20" });
  const hoy = new Date().toISOString().slice(0, 10);
  const pesos = await api.post("/cuentas", { nombre: "BBVA", tipo: "debito", balance_inicial: "10000" });
  const euros = await api.post("/cuentas", { nombre: "Revolut", tipo: "debito", moneda: "EUR" });
  // 2000 MXN deberían ser 100 EUR; llegaron 97 (3 EUR = 60 MXN) y hubo 20 MXN de comisión.
  await api.post("/transferencias", {
    cuenta_origen_id: pesos.id, cuenta_destino_id: euros.id, monto_origen: "2000", monto_destino: "97", comision: "20", fecha: hoy,
  });
  // Sin decir lo que llegó: la app lo estima y no hay coste que enseñar.
  await api.post("/transferencias", { cuenta_origen_id: pesos.id, cuenta_destino_id: euros.id, monto_origen: "100", fecha: hoy });

  await abrir(pagina, "/cuentas");
  const costes = pagina.getByText(/^Te costó/);
  await costes.first().waitFor();
  const texto = await costes.first().textContent();
  comprobar((await costes.count()) === 1 && texto.includes("80") && texto.includes("4 %"), `la transferencia muestra su coste (${texto})`);
  await pagina.screenshot({ path: `${CAPTURAS}/envios-lista.png` });

  await abrir(pagina, "/dashboard");
  const widget = pagina.getByText(/^Coste envíos \d{4}$/).locator("xpath=ancestor::div[contains(@class, 'rounded-3xl')][1]");
  await widget.waitFor();
  const contenido = await widget.textContent();
  comprobar(contenido.includes("80") && contenido.includes("1 envío"), `el widget suma el año (${contenido.replace(/\s+/g, " ").trim()})`);
  await widget.screenshot({ path: `${CAPTURAS}/envios-widget.png` });

  // Poder adquisitivo: cobras en pesos y gastas en euros. Con un solo día de tasas aún no
  // hay media de 12 meses, y el widget lo explica en vez de dar un número inventado.
  const [sueldo] = (await api.get("/categorias")).filter((c) => c.tipo === "ingreso");
  const [gasto] = (await api.get("/categorias")).filter((c) => c.tipo === "gasto");
  await api.post("/transacciones", { monto: "40000", tipo: "ingreso", fecha: hoy, cuenta_id: pesos.id, categoria_id: sueldo.id });
  await api.post("/transacciones", { monto: "1500", tipo: "gasto", fecha: hoy, cuenta_id: euros.id, categoria_id: gasto.id });
  await abrir(pagina, "/dashboard");
  const poder = pagina.getByText("Rinde tu MXN en EUR").locator("xpath=ancestor::div[contains(@class, 'rounded-3xl')][1]");
  await poder.waitFor();
  const textoPoder = (await poder.textContent()).replace(/\s+/g, " ");
  await poder.screenshot({ path: `${CAPTURAS}/poder-widget.png` });
  comprobar(textoPoder.includes("Hacen falta unas semanas de tasas"), `poder adquisitivo sin historial (${textoPoder.trim()})`);
});
