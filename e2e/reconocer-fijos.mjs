// Reconocer un fijo al anotarlo a mano (la nómina) o al importarlo (el alquiler): su fecha
// avanza y el Plan del mes no lo cuenta dos veces.
import { CAPTURAS, abrir, comprobar, prueba } from "./comun.mjs";

const hoy = new Date().toISOString().slice(0, 10);
const [anio, mes, dia] = hoy.split("-");

await prueba("reconocer-fijos", async ({ pagina, api }) => {
  const bbva = await api.post("/cuentas", { nombre: "BBVA", tipo: "debito", balance_inicial: "1000" });
  const categorias = await api.get("/categorias");
  const sueldo = categorias.find((c) => c.tipo === "ingreso");
  const vivienda = categorias.find((c) => c.nombre === "Vivienda") ?? categorias.find((c) => c.tipo === "gasto");
  const nomina = await api.post("/ingresos-recurrentes", {
    nombre: "Nómina", monto: "2000", periodicidad: "mensual", fecha_proximo_cobro: hoy,
    cuenta_id: bbva.id, categoria_id: sueldo.id,
  });
  const alquiler = await api.post("/suscripciones", {
    nombre: "Alquiler", monto: "800", periodicidad: "mensual", fecha_proximo_pago: hoy,
    cuenta_id: bbva.id, categoria_id: vivienda.id,
  });

  // --- Anotar la nómina a mano: pregunta si es el cobro fijo ----------------
  await abrir(pagina, "/transacciones");
  await pagina.getByRole("button", { name: "Nueva", exact: true }).click();
  const ventana = pagina.getByRole("dialog");
  await ventana.getByRole("button", { name: "Ingreso", exact: true }).click();
  await ventana.getByLabel("Importe", { exact: true }).fill("1990");
  await ventana.getByRole("button", { name: sueldo.nombre, exact: true }).click();
  const pregunta = pagina.getByRole("alertdialog");
  await pregunta.waitFor();
  const texto = await pregunta.textContent();
  comprobar(/¿Es el cobro de «Nómina» del/.test(texto), `pregunta si es la nómina (${texto.slice(0, 60)}…)`);
  await pagina.screenshot({ path: `${CAPTURAS}/reconocer-fijos-pregunta.png` });
  await pregunta.getByRole("button", { name: "Sí", exact: true }).click();
  await pagina.getByText("Listo: el cobro de «Nómina» ya cuenta como cobrado").waitFor();
  const cobrada = await api.get(`/ingresos-recurrentes/${nomina.id}`);
  comprobar(cobrada.fecha_proximo_cobro > hoy, `la nómina pasa al mes siguiente (${hoy} → ${cobrada.fecha_proximo_cobro})`);
  const ingresos = await api.get("/transacciones?tipo=ingreso");
  comprobar(
    ingresos.length === 1 && ingresos[0].ingreso_recurrente_id === nomina.id,
    "no se crea otro ingreso: el anotado queda vinculado a la nómina",
  );
  await pagina.getByRole("button", { name: /^Listo · 1 anotado/ }).click();
  await ventana.waitFor({ state: "detached" });

  // --- Importar el alquiler: sugerido y marcado por defecto -----------------
  const extracto = Buffer.from(
    "Fecha;Concepto;Importe;Saldo\n" +
    `${dia}/${mes}/${anio};TRANSFERENCIA ALQUILER;-800,00;2.190,00\n` +
    `${dia}/${mes}/${anio};CAFETERIA LUNA;-3,50;2.186,50\n`,
    "latin1",
  );
  await pagina.getByRole("button", { name: "Importar", exact: true }).click();
  await pagina.locator('input[type="file"]').setInputFiles({ name: "extracto.csv", mimeType: "text/csv", buffer: extracto });
  await pagina.getByText("1 parece un cobro o pago fijo", { exact: false }).waitFor();
  await pagina.getByRole("button", { name: /^Todos/ }).click();
  const casilla = pagina.getByRole("checkbox", { name: /Parece el pago de «Alquiler»/ });
  comprobar(await casilla.isChecked(), "la fila del alquiler dice «Parece el pago de «Alquiler»» y va marcada");
  comprobar((await pagina.getByRole("checkbox", { name: /^Parece/ }).count()) === 1, "el café no se parece a ningún fijo");
  await pagina.screenshot({ path: `${CAPTURAS}/reconocer-fijos-importar.png` });
  await pagina.getByRole("button", { name: /^Importar \d+ movimiento/ }).click();
  await pagina.getByText(/1 cobro o pago fijo reconocido/).waitFor();
  const pagado = await api.get(`/suscripciones/${alquiler.id}`);
  comprobar(pagado.fecha_proximo_pago > hoy, `el alquiler pasa al mes siguiente (${hoy} → ${pagado.fecha_proximo_pago})`);
  const gastos = await api.get("/transacciones?tipo=gasto");
  comprobar(
    gastos.find((t) => t.notas === "TRANSFERENCIA ALQUILER")?.suscripcion_id === alquiler.id,
    "el gasto importado cuenta como pago fijo",
  );
});
