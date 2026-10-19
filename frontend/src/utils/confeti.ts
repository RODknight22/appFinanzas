/**
 * Confeti en un <canvas> temporal, sin librerías (unas pocas líneas pesan
 * menos que una dependencia). El canvas se crea, se anima ~2,5 s y se borra.
 */

interface OpcionesConfeti {
  /** Punto de salida en fracciones de la pantalla (0-1). Por defecto, el centro. */
  x?: number;
  y?: number;
  cantidad?: number;
  /** Apertura del chorro en grados: 70 = cono estrecho hacia arriba, 360 = en todas direcciones. */
  dispersion?: number;
  /** Hacia dónde apunta el chorro, en grados: -90 = arriba, -60 = arriba a la derecha. */
  direccion?: number;
}

interface Pieza {
  x: number;
  y: number;
  vx: number;
  vy: number;
  giro: number;
  velocidadGiro: number;
  ancho: number;
  alto: number;
  color: string;
  /** Milisegundos que tarda en salir: si todas salen a la vez forman una bola. */
  retraso: number;
}

const DURACION_MS = 2600;
const GRAVEDAD = 0.28;
const ROZAMIENTO = 0.985;

/** Colores: los del acento elegido (leídos del CSS) más algunos festivos. */
function colores(): string[] {
  const css = getComputedStyle(document.documentElement);
  const acento = ["--color-acento-300", "--color-acento-400", "--color-acento-500"].map((v) => css.getPropertyValue(v).trim());
  return [...acento.filter(Boolean), "#fbbf24", "#f472b6", "#60a5fa", "#ffffff"];
}

export function lanzarConfeti({ x = 0.5, y = 0.5, cantidad = 120, dispersion = 70, direccion = -90 }: OpcionesConfeti = {}): void {
  // Quien pide menos movimiento en su sistema no recibe confeti.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:100";
  document.body.appendChild(canvas);
  // Pantallas de alta densidad (móviles, Retina): más píxeles reales para que no se vea borroso.
  const densidad = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * densidad;
  canvas.height = window.innerHeight * densidad;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  ctx.scale(densidad, densidad);

  const paleta = colores();
  const piezas: Pieza[] = Array.from({ length: cantidad }, () => {
    // Ángulo alrededor de la dirección pedida, dentro de la apertura.
    const angulo = ((direccion + (Math.random() - 0.5) * dispersion) * Math.PI) / 180;
    const velocidad = 4 + Math.random() * 13;
    return {
      x: x * window.innerWidth,
      y: y * window.innerHeight,
      vx: Math.cos(angulo) * velocidad,
      vy: Math.sin(angulo) * velocidad,
      giro: Math.random() * Math.PI,
      velocidadGiro: (Math.random() - 0.5) * 0.35,
      ancho: 5 + Math.random() * 5,
      alto: 7 + Math.random() * 7,
      color: paleta[Math.floor(Math.random() * paleta.length)],
      retraso: Math.random() * 350,
    };
  });

  const inicio = performance.now();
  function cuadro(ahora: number) {
    const transcurrido = ahora - inicio;
    ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);
    // Se desvanece en el último tercio.
    ctx!.globalAlpha = Math.min(1, (DURACION_MS - transcurrido) / (DURACION_MS / 3));
    for (const p of piezas) {
      if (transcurrido < p.retraso) continue;
      p.vy += GRAVEDAD;
      p.vx *= ROZAMIENTO;
      p.vy *= ROZAMIENTO;
      p.x += p.vx;
      p.y += p.vy;
      p.giro += p.velocidadGiro;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.giro);
      ctx!.fillStyle = p.color;
      // cos(giro) en el alto: el papelito parece dar vueltas en 3D.
      ctx!.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto * Math.cos(p.giro));
      ctx!.restore();
    }
    if (transcurrido < DURACION_MS) requestAnimationFrame(cuadro);
    else canvas.remove();
  }
  requestAnimationFrame(cuadro);
}

/** La gran celebración: tres chorros (izquierda, derecha y centro) casi a la vez. */
export function lanzarFiesta(): void {
  // Desde las esquinas inferiores, apuntando hacia el centro como cañones de confeti.
  lanzarConfeti({ x: 0.05, y: 0.95, cantidad: 90, dispersion: 40, direccion: -60 });
  lanzarConfeti({ x: 0.95, y: 0.95, cantidad: 90, dispersion: 40, direccion: -120 });
  // El central sale desde arriba de la ventana para no tapar el mensaje al empezar.
  setTimeout(() => lanzarConfeti({ x: 0.5, y: 0.15, cantidad: 120, dispersion: 360 }), 250);
}
