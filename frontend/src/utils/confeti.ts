/**
 * Confeti en un <canvas> temporal, sin librerías (unas pocas líneas pesan
 * menos que una dependencia).
 *
 * Pensado para que cada fotograma cueste poco:
 * - Un único canvas compartido: si se lanza otra vez mientras cae el anterior,
 *   las piezas nuevas se suman al mismo bucle en vez de apilar lienzos.
 * - Sin save/restore por pieza: cada una fija su matriz con setTransform y se
 *   añade al trazo de su color; luego un solo fill() por color.
 * - Solo se borra la zona donde hubo piezas el fotograma anterior.
 * - Densidad de píxeles limitada a 2 (en un móvil a 3x el lienzo pesaría más del doble).
 * - El bucle se pausa con la pestaña oculta y, al quedarse sin piezas, se
 *   detiene y el canvas desaparece.
 */

interface OpcionesConfeti {
  /** Punto de salida en fracciones de la pantalla (0-1). Por defecto, el centro. */
  x?: number;
  y?: number;
  /** Piezas en una pantalla de escritorio; en pantallas pequeñas salen menos. */
  cantidad?: number;
  /** Apertura del chorro en grados: 70 = cono estrecho hacia arriba, 360 = en todas direcciones. */
  dispersion?: number;
  /** Hacia dónde apunta el chorro, en grados: -90 = arriba, -60 = arriba a la derecha. */
  direccion?: number;
  /** En cuántos golpes sale: 2 = un estallido y un eco más pequeño justo después. */
  rafagas?: number;
  /** Milisegundos que vive cada pieza antes de encogerse y desaparecer. */
  duracion?: number;
}

type Forma = "papel" | "circulo" | "tira";

interface Pieza {
  forma: Forma;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Giro en el plano de la pantalla. */
  giro: number;
  velocidadGiro: number;
  /** Giro "en 3D": su coseno estrecha el ancho, como un papel que voltea al caer. */
  volteo: number;
  velocidadVolteo: number;
  /** Fase del aleteo lateral (va y viene como una hoja). */
  fase: number;
  velocidadFase: number;
  amplitud: number;
  /** Viento suave propio de cada pieza: así no caen todas en vertical. */
  deriva: number;
  /** Velocidad de caída máxima: el papel planea, no cae como una piedra. */
  caidaMaxima: number;
  ancho: number;
  alto: number;
  /** Momento de salida en el reloj del motor: si todas salen a la vez forman una bola. */
  nace: number;
  vida: number;
}

interface Caja {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Motor {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  densidad: number;
  ancho: number;
  alto: number;
  paleta: string[];
  /** Piezas agrupadas por color: un cambio de fillStyle y un fill() por grupo. */
  grupos: Map<string, Pieza[]>;
  total: number;
  /** Milisegundos simulados: no avanza con la pestaña oculta, así nada "salta" al volver. */
  reloj: number;
  ultimoCuadro: number | null;
  idCuadro: number;
  /** Zona pintada en el fotograma anterior (en px CSS), la única que hay que borrar. */
  sucio: Caja | null;
}

/** Las velocidades están en px por fotograma a 60 Hz; se escalan con el tiempo real. */
const FOTOGRAMA_MS = 1000 / 60;
const GRAVEDAD = 0.26;
const ROZAMIENTO = 0.982;
const DENSIDAD_MAXIMA = 2;
const MAX_PIEZAS = 450;
/** Medio tamaño máximo de una pieza girada: margen para borrar y para darla por fuera. */
const MARGEN = 16;
const DURACION_MS = 3200;
const ENCOGER_MS = 700;
const SEPARACION_RAFAGAS_MS = 240;

let motor: Motor | null = null;

/** Colores: los del acento elegido (leídos del CSS) más algunos festivos. */
function colores(): string[] {
  const css = getComputedStyle(document.documentElement);
  const acento = ["--color-acento-300", "--color-acento-400", "--color-acento-500"].map((v) => css.getPropertyValue(v).trim());
  return [...acento.filter(Boolean), "#fbbf24", "#f472b6", "#60a5fa", "#ffffff"];
}

/** 1 en escritorio, menos en móvil: la misma cantidad taparía una pantalla pequeña. */
function factorPantalla(): number {
  const area = window.innerWidth * window.innerHeight;
  return Math.min(1, Math.max(0.45, area / (1280 * 800)));
}

const azar = (min: number, max: number) => min + Math.random() * (max - min);

function ajustarTamano(m: Motor): void {
  m.densidad = Math.min(DENSIDAD_MAXIMA, window.devicePixelRatio || 1);
  m.ancho = window.innerWidth;
  m.alto = window.innerHeight;
  // Cambiar el tamaño vacía el lienzo, así que no queda nada que borrar.
  m.canvas.width = Math.round(m.ancho * m.densidad);
  m.canvas.height = Math.round(m.alto * m.densidad);
  m.sucio = null;
}

function alRedimensionar(): void {
  if (motor) ajustarTamano(motor);
}

function alCambiarVisibilidad(): void {
  if (!motor) return;
  cancelAnimationFrame(motor.idCuadro);
  if (!document.hidden) {
    motor.ultimoCuadro = null;
    motor.idCuadro = requestAnimationFrame(cuadro);
  }
}

function crearMotor(): Motor | null {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:100";
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  document.body.appendChild(canvas);
  const nuevo: Motor = {
    canvas,
    ctx,
    densidad: 1,
    ancho: 0,
    alto: 0,
    paleta: colores(),
    grupos: new Map(),
    total: 0,
    reloj: 0,
    ultimoCuadro: null,
    idCuadro: 0,
    sucio: null,
  };
  ajustarTamano(nuevo);
  window.addEventListener("resize", alRedimensionar);
  document.addEventListener("visibilitychange", alCambiarVisibilidad);
  if (!document.hidden) nuevo.idCuadro = requestAnimationFrame(cuadro);
  return nuevo;
}

/** Para el bucle y quita el canvas y los oyentes: siempre se pasa por aquí al terminar. */
function detener(): void {
  if (!motor) return;
  cancelAnimationFrame(motor.idCuadro);
  window.removeEventListener("resize", alRedimensionar);
  document.removeEventListener("visibilitychange", alCambiarVisibilidad);
  motor.canvas.remove();
  motor = null;
}

function cuadro(ahora: number): void {
  const m = motor;
  if (!m) return;
  // Alguien pudo quitar el canvas (p. ej. al rehacer el <body>): no seguir pintando a ciegas.
  if (!m.canvas.isConnected) return detener();
  // Tope de 3 fotogramas: tras un tirón, mejor ir algo lento que teletransportar piezas.
  const dt = m.ultimoCuadro === null ? FOTOGRAMA_MS : Math.min(ahora - m.ultimoCuadro, FOTOGRAMA_MS * 3);
  m.ultimoCuadro = ahora;
  m.reloj += dt;
  try {
    avanzarYPintar(m, dt / FOTOGRAMA_MS);
  } catch (error) {
    detener();
    throw error;
  }
  if (m.total === 0) return detener();
  m.idCuadro = requestAnimationFrame(cuadro);
}

/** Un paso de física y pintado; `f` = fotogramas de 60 Hz transcurridos (1 a 60 Hz, 0,5 a 120 Hz). */
function avanzarYPintar(m: Motor, f: number): void {
  const { ctx, densidad: d } = m;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (m.sucio) {
    const { x0, y0, x1, y1 } = m.sucio;
    ctx.clearRect(x0 * d, y0 * d, (x1 - x0) * d, (y1 - y0) * d);
  }
  const rozamiento = Math.pow(ROZAMIENTO, f);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let total = 0;

  for (const [color, piezas] of m.grupos) {
    ctx.beginPath();
    let vivas = 0;
    let pintadas = 0;
    for (const p of piezas) {
      const edad = m.reloj - p.nace;
      if (edad < 0) {
        piezas[vivas++] = p; // aún no ha salido
        continue;
      }
      p.vx *= rozamiento;
      p.vy = p.vy * rozamiento + GRAVEDAD * f;
      // Pasada la velocidad de planeo, el aire la frena poco a poco (sin tirón).
      if (p.vy > p.caidaMaxima) p.vy += (p.caidaMaxima - p.vy) * Math.min(1, 0.08 * f);
      p.fase += p.velocidadFase * f;
      p.x += (p.vx + p.deriva + Math.sin(p.fase) * p.amplitud) * f;
      p.y += p.vy * f;
      p.giro += p.velocidadGiro * f;
      p.volteo += p.velocidadVolteo * f;

      const fuera = p.y > m.alto + MARGEN || p.x < -MARGEN * 4 || p.x > m.ancho + MARGEN * 4;
      if (edad > p.vida || fuera) continue; // se descarta
      piezas[vivas++] = p;

      // Al final de su vida se encoge hasta desaparecer: más limpio que bajar la opacidad
      // y permite pintar todo un color de una vez.
      const escala = Math.min(1, (p.vida - edad) / ENCOGER_MS) * d;
      const cos = Math.cos(p.giro) * escala;
      const sin = Math.sin(p.giro) * escala;
      // cos(volteo) en el ancho: el papelito parece dar vueltas en 3D (nunca 0: la matriz dejaría de ser válida).
      let voltear = Math.cos(p.volteo);
      if (Math.abs(voltear) < 0.08) voltear = voltear < 0 ? -0.08 : 0.08;
      // Matriz = mover a (x, y) · girar · estrechar el ancho, todo multiplicado por la densidad.
      ctx.setTransform(cos * voltear, sin * voltear, -sin, cos, p.x * d, p.y * d);
      if (p.forma === "circulo") {
        ctx.moveTo(p.ancho / 2, 0); // sin esto el trazo uniría este círculo con la pieza anterior
        ctx.arc(0, 0, p.ancho / 2, 0, Math.PI * 2);
      } else {
        ctx.rect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto);
      }
      pintadas++;
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
    piezas.length = vivas;
    total += vivas;
    if (vivas === 0) m.grupos.delete(color);
    else if (pintadas > 0) {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  m.total = total;
  m.sucio = x0 === Infinity ? null : { x0: x0 - MARGEN, y0: y0 - MARGEN, x1: x1 + MARGEN, y1: y1 + MARGEN };
}

function crearPieza(origenX: number, origenY: number, angulo: number, velocidad: number, nace: number, vida: number): Pieza {
  const r = Math.random();
  // Mezcla: sobre todo papelitos, algunas tiras finas que aletean rápido y pocos círculos.
  const forma: Forma = r < 0.14 ? "circulo" : r < 0.36 ? "tira" : "papel";
  const diametro = azar(5, 8);
  const [ancho, alto] =
    forma === "circulo" ? [diametro, diametro] : forma === "tira" ? [azar(2, 3), azar(11, 16)] : [azar(6, 10), azar(8, 12)];
  return {
    forma,
    x: origenX,
    y: origenY,
    vx: Math.cos(angulo) * velocidad,
    vy: Math.sin(angulo) * velocidad,
    giro: Math.random() * Math.PI * 2,
    velocidadGiro: azar(-0.12, 0.12),
    volteo: Math.random() * Math.PI * 2,
    velocidadVolteo: forma === "tira" ? azar(0.18, 0.32) : azar(0.06, 0.2),
    fase: Math.random() * Math.PI * 2,
    velocidadFase: azar(0.04, 0.1),
    amplitud: forma === "circulo" ? azar(0.2, 0.6) : azar(0.5, 1.4),
    deriva: azar(-0.35, 0.35),
    // Las tiras y los círculos cortan mejor el aire: caen algo más rápido.
    caidaMaxima: forma === "papel" ? azar(2.2, 3.2) : azar(3, 4.2),
    ancho,
    alto,
    nace,
    vida,
  };
}

export function lanzarConfeti({
  x = 0.5,
  y = 0.5,
  cantidad = 120,
  dispersion = 70,
  direccion = -90,
  rafagas = 2,
  duracion = DURACION_MS,
}: OpcionesConfeti = {}): void {
  // Quien pide menos movimiento en su sistema no recibe confeti.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  if (motor && !motor.canvas.isConnected) detener();
  motor ??= crearMotor();
  if (!motor) return;
  const m = motor;

  const piezasNuevas = Math.max(0, Math.min(Math.round(cantidad * factorPantalla()), MAX_PIEZAS - m.total));
  const origenX = x * m.ancho;
  const origenY = y * m.alto;
  const golpes = Math.max(1, Math.round(rafagas));
  for (let i = 0; i < piezasNuevas; i++) {
    // El primer golpe se lleva ~60 % de las piezas; los siguientes, el resto a partes iguales.
    const golpe = golpes === 1 || Math.random() < 0.6 ? 0 : 1 + Math.floor(Math.random() * (golpes - 1));
    const angulo = ((direccion + (Math.random() - 0.5) * dispersion) * Math.PI) / 180;
    // Cada eco sale un poco más flojo, como un segundo cañonazo más corto.
    const velocidad = azar(5, 16) * (golpe === 0 ? 1 : 0.8);
    const nace = m.reloj + golpe * SEPARACION_RAFAGAS_MS + Math.random() * 120;
    const pieza = crearPieza(origenX, origenY, angulo, velocidad, nace, duracion * azar(0.85, 1.1));
    const color = m.paleta[Math.floor(Math.random() * m.paleta.length)];
    const grupo = m.grupos.get(color);
    if (grupo) grupo.push(pieza);
    else m.grupos.set(color, [pieza]);
  }
  m.total += piezasNuevas;
  if (m.total === 0) detener();
}

/** La gran celebración: tres chorros (izquierda, derecha y centro) casi a la vez. */
export function lanzarFiesta(): void {
  // Desde las esquinas inferiores, apuntando hacia el centro como cañones de confeti.
  lanzarConfeti({ x: 0.05, y: 0.95, cantidad: 90, dispersion: 40, direccion: -60, duracion: 3800 });
  lanzarConfeti({ x: 0.95, y: 0.95, cantidad: 90, dispersion: 40, direccion: -120, duracion: 3800 });
  // El central sale desde arriba de la ventana para no tapar el mensaje al empezar.
  setTimeout(() => lanzarConfeti({ x: 0.5, y: 0.15, cantidad: 120, dispersion: 360, rafagas: 1, duracion: 3800 }), 250);
}
