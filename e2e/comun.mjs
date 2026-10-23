// Utilidades compartidas por las pruebas E2E (las ejecuta scripts/e2e.sh).
import { chromium } from "playwright";

export const BASE = process.env.BASE ?? "http://localhost:5173";
export const CAPTURAS = "/capturas";

/** Abre el navegador, se registra (la BD está vacía) y recoge los errores de consola. */
export async function iniciar({ ancho = 1280, alto = 900 } = {}) {
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto }, locale: "es-ES" });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("console", (m) => m.type() === "error" && errores.push(`[${pagina.url()}] ${m.text()}`));
  pagina.on("pageerror", (e) => errores.push(`[${pagina.url()}] excepción: ${e.message}`));

  const api = {
    async get(ruta) {
      const r = await contexto.request.get(`${BASE}/api${ruta}`);
      if (!r.ok()) throw new Error(`GET ${ruta}: ${r.status()} ${await r.text()}`);
      return r.json();
    },
    async post(ruta, datos) {
      const r = await contexto.request.post(`${BASE}/api${ruta}`, { data: datos });
      if (!r.ok()) throw new Error(`POST ${ruta}: ${r.status()} ${await r.text()}`);
      return r.status() === 204 ? null : r.json();
    },
    async put(ruta, datos) {
      const r = await contexto.request.put(`${BASE}/api${ruta}`, { data: datos });
      if (!r.ok()) throw new Error(`PUT ${ruta}: ${r.status()} ${await r.text()}`);
      return r.json();
    },
    async patch(ruta, datos) {
      const r = await contexto.request.patch(`${BASE}/api${ruta}`, { data: datos });
      if (!r.ok()) throw new Error(`PATCH ${ruta}: ${r.status()} ${await r.text()}`);
      return r.json();
    },
  };
  await api.post("/auth/registro", { usuario: "prueba", contrasena: "prueba1234" });
  return { navegador, pagina, api, errores };
}

/** Va a una página y cierra la bienvenida del primer uso si aparece (tapa los botones). */
export async function abrir(pagina, ruta) {
  await pagina.goto(`${BASE}${ruta}`);
  // waitFor espera a que aparezca (isVisible no espera): si en 3 s no sale, no hay bienvenida.
  const saltar = pagina.getByRole("button", { name: "Saltar" });
  const aparecio = await saltar.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false);
  if (aparecio) await saltar.click();
}

/** Comprobación con mensaje claro: si falla, la prueba termina en error. */
export function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(`Comprobación fallida: ${mensaje}`);
  console.log(`  ✔ ${mensaje}`);
}

/** Ejecuta la prueba; ante cualquier fallo guarda una captura y sale con código 1. */
export async function prueba(nombre, cuerpo) {
  let estado;
  try {
    estado = await iniciar();
    await cuerpo(estado);
    comprobar(estado.errores.length === 0, `sin errores en la consola${estado.errores.length ? `:\n    ${estado.errores.join("\n    ")}` : ""}`);
  } catch (error) {
    console.error(`  ✘ ${error.message}`);
    await estado?.pagina.screenshot({ path: `${CAPTURAS}/${nombre}-fallo.png` }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await estado?.navegador.close();
  }
}
