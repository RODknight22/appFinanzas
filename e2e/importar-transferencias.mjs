// Importar un extracto de Revolut: "To MXN" es dinero que llega de otra cuenta tuya, no un ingreso.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

const EXTRACTO = Buffer.from(
  "Type,Started Date,Completed Date,Description,Amount,Fee,Balance\n" +
  "TRANSFER,2026-10-02 10:00:00,2026-10-02 10:00:05,To MXN,2000.00,0.00,2000.00\n" +
  "TRANSFER,2026-10-09 10:00:00,2026-10-09 10:00:05,To MXN,1000.00,0.00,3000.00\n" +
  "CARD_PAYMENT,2026-10-03 12:00:00,2026-10-04 09:00:00,Tienda Ejemplo,-150.00,0.00,2850.00\n",
);

await prueba("importar-transferencias", async ({ pagina, api }) => {
  // Sin internet en las E2E: tasas a mano (1 USD = 18 MXN, 1 EUR = 20 MXN).
  await api.put("/tasas/USD", { en_principal: "18" });
  await api.put("/tasas/EUR", { en_principal: "20" });
  const pesos = await api.post("/cuentas", { nombre: "Revolut MXN", tipo: "debito", moneda: "MXN" });
  await api.post("/cuentas", { nombre: "Revolut", tipo: "debito", moneda: "EUR" });
  await api.post("/cuentas", { nombre: "Santander", tipo: "debito", moneda: "EUR" });

  await abrir(pagina, "/transacciones");
  await pagina.getByRole("button", { name: "Importar", exact: true }).click();
  await pagina.getByRole("dialog").getByLabel("Cuenta").selectOption({ label: "Revolut MXN (MXN)" });
  await pagina.locator('input[type="file"]').setInputFiles({ name: "revolut.csv", mimeType: "text/csv", buffer: EXTRACTO });
  await pagina.getByText("por importar").waitFor();
  await pagina.getByRole("button", { name: /^Todos/ }).click();

  const elegidas = await pagina.locator("li", { hasText: "To MXN" }).getByLabel("Categoría o transferencia")
    .evaluateAll((selects) => selects.map((s) => s.options[s.selectedIndex].text));
  comprobar(elegidas.join() === "Desde Revolut,Desde Revolut", `"To MXN" se propone como transferencia desde Revolut (${elegidas.join(" / ")})`);
  await pagina.screenshot({ path: `${CAPTURAS}/importar-transferencias.png` });

  await pagina.getByRole("button", { name: /^Importar \d+ movimiento/ }).click();
  await pagina.getByText("2 como transferencias entre tus cuentas").waitFor();
  comprobar(true, "el resumen cuenta las transferencias aparte");
  const resumen = await api.get("/dashboard/resumen?mes_anio=2026-10");
  const transferencias = await api.get(`/transferencias?cuenta_id=${pesos.id}`);
  comprobar(transferencias.length === 2 && resumen.ingresos === "0.00" && resumen.gastos === "150.00",
    `no infla los ingresos (ingresos ${resumen.ingresos}, gastos ${resumen.gastos}, ${transferencias.length} transferencias)`);
});
