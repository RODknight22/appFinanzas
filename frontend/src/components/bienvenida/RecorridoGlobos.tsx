import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Boton } from "../ui/Boton";

/**
 * Una frase por apartado: el recorrido debe ser rápido. `clave` es el valor del
 * atributo data-tutorial del enlace que se señala (en el menú lateral, la barra de
 * abajo o la cabecera del móvil: se usa el que esté a la vista).
 */
const PASOS: { clave: string; titulo: string; texto: string }[] = [
  { clave: "/dashboard", titulo: "Dashboard", texto: "Tu mes de un vistazo. Con «Personalizar» mueves, agrandas u ocultas los widgets." },
  { clave: "/transacciones", titulo: "Transacciones", texto: "Cada gasto e ingreso. Con «Nueva» anotas en dos toques, y aquí importas los extractos del banco." },
  { clave: "/presupuestos", titulo: "Presupuestos", texto: "Un límite al mes por categoría, para ver cuánto te queda antes de pasarte." },
  { clave: "/metas", titulo: "Metas", texto: "Ahorra para algo concreto. En la pestaña Deseos apuntas lo que te quieres comprar." },
  { clave: "/deudas", titulo: "Deudas", texto: "Quién te debe y a quién debes, con cada abono." },
  { clave: "/pagos-fijos", titulo: "Pagos fijos", texto: "Suscripciones e ingresos fijos como tu sueldo. La campana te avisa antes de cada uno." },
  { clave: "/cuentas", titulo: "Cuentas", texto: "Bancos, tarjetas y efectivo, cada uno en su moneda." },
  { clave: "/categorias", titulo: "Categorías", texto: "Crea las tuyas, con su icono y su color." },
  { clave: "/ajustes", titulo: "Ajustes", texto: "Perfil, estilos, monedas y copia de seguridad. Aquí repites este recorrido u ocultas las bombillas de consejos." },
];

const ANCHO = 288;
const MARGEN = 8; // distancia mínima a los bordes de la ventana
const HOLGURA = 6; // cuánto sobresale el foco alrededor del enlace
const SEPARACION = 14; // entre el foco y el globo

/** El enlace señalado que está a la vista (los del menú que no se usan en esta pantalla están ocultos). */
function buscarObjetivo(clave: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>(`[data-tutorial="${clave}"]`)].find((el) => el.getClientRects().length > 0);
}

interface Colocacion {
  foco: { top: number; left: number; width: number; height: number };
  globo: { top: number; left: number; ancho: number };
}

/** A la derecha del enlace (menú lateral); si no cabe, debajo (cabecera) o encima (barra de abajo). */
function colocar(objetivo: HTMLElement, altoGlobo: number): Colocacion {
  const r = objetivo.getBoundingClientRect();
  const foco = { top: r.top - HOLGURA, left: r.left - HOLGURA, width: r.width + 2 * HOLGURA, height: r.height + 2 * HOLGURA };
  const ancho = Math.min(ANCHO, window.innerWidth - 2 * MARGEN);
  const limitar = (valor: number, maximo: number) => Math.min(Math.max(MARGEN, valor), maximo - MARGEN);
  const derecha = foco.left + foco.width + SEPARACION;
  if (derecha + ancho <= window.innerWidth - MARGEN) {
    const top = limitar(r.top + r.height / 2 - altoGlobo / 2, window.innerHeight - altoGlobo);
    return { foco, globo: { top, left: derecha, ancho } };
  }
  const left = limitar(r.left + r.width / 2 - ancho / 2, window.innerWidth - ancho);
  const debajo = foco.top + foco.height + SEPARACION;
  const top = debajo + altoGlobo <= window.innerHeight - MARGEN ? debajo : foco.top - SEPARACION - altoGlobo;
  return { foco, globo: { top, left, ancho } };
}

/**
 * Recorrido por el menú con globos de texto sobre la pantalla real. Se puede saltar
 * en cualquier momento (botón o Esc) y moverse con las flechas del teclado.
 */
export function RecorridoGlobos({ onTerminar }: { onTerminar: () => void }) {
  // Solo los pasos cuyo enlace existe: si alguno no está a la vista, se salta solo.
  const [pasos] = useState(() => PASOS.filter((paso) => buscarObjetivo(paso.clave)));
  const [indice, setIndice] = useState(0);
  const [colocacion, setColocacion] = useState<Colocacion | null>(null);
  const refGlobo = useRef<HTMLDivElement>(null);
  const paso = pasos[indice];
  const ultimo = indice === pasos.length - 1;

  const siguiente = useCallback(() => (ultimo ? onTerminar() : setIndice((i) => i + 1)), [ultimo, onTerminar]);
  const anterior = useCallback(() => setIndice((i) => Math.max(0, i - 1)), []);

  // Se recoloca en cada paso y si cambia el tamaño de la ventana (p. ej. al girar el móvil).
  useLayoutEffect(() => {
    if (!paso) return;
    function recolocar() {
      const objetivo = buscarObjetivo(paso.clave);
      if (objetivo) setColocacion(colocar(objetivo, refGlobo.current?.offsetHeight ?? 160));
    }
    recolocar();
    window.addEventListener("resize", recolocar);
    return () => window.removeEventListener("resize", recolocar);
  }, [paso]);

  useEffect(() => {
    // El foco va a "Siguiente": con Intro se avanza sin buscar el botón.
    if (colocacion) refGlobo.current?.querySelector<HTMLButtonElement>("[data-siguiente]")?.focus({ preventScroll: true });
  }, [indice, colocacion]);

  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") onTerminar();
      else if (evento.key === "ArrowRight") siguiente();
      else if (evento.key === "ArrowLeft") anterior();
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onTerminar, siguiente, anterior]);

  // Sin ningún enlace a la vista no hay nada que enseñar.
  useEffect(() => {
    if (pasos.length === 0) onTerminar();
  }, [pasos.length, onTerminar]);
  if (!paso) return null;

  const visible = colocacion !== null;
  return createPortal(
    // La capa de fondo recoge los clics: durante el recorrido no se navega por error.
    <div className="fixed inset-0 z-[70]">
      {colocacion && (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-2xl ring-2 ring-acento-500 transition-[top,left,width,height] duration-300 ease-out"
          // La sombra enorme oscurece todo menos el hueco del enlace señalado.
          style={{ ...colocacion.foco, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)" }}
        />
      )}
      <div
        // Solo se anima la posición: si `visibility` también se animara, el globo seguiría
        // oculto un instante al aparecer y no podría recibir el foco.
        ref={refGlobo}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recorrido-titulo"
        aria-describedby="recorrido-texto"
        className="fixed rounded-2xl bg-superficie p-4 shadow-2xl ring-1 ring-linea transition-[top,left] duration-300 ease-out"
        style={{
          top: colocacion?.globo.top ?? 0,
          left: colocacion?.globo.left ?? 0,
          width: colocacion?.globo.ancho ?? ANCHO,
          visibility: visible ? "visible" : "hidden",
        }}
      >
        <p className="text-xs font-semibold text-acento-600 tabular-nums dark:text-acento-400">
          {indice + 1} de {pasos.length}
        </p>
        <h3 id="recorrido-titulo" className="mt-1 font-bold">{paso.titulo}</h3>
        <p id="recorrido-texto" className="mt-1 text-sm text-suave">{paso.texto}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Boton variante="fantasma" className="px-3 py-1.5 text-xs" onClick={onTerminar}>Saltar</Boton>
          <div className="flex gap-1.5">
            {indice > 0 && (
              <Boton variante="secundario" className="px-3 py-1.5 text-xs" onClick={anterior}>Atrás</Boton>
            )}
            <Boton data-siguiente className="px-3 py-1.5 text-xs" onClick={siguiente}>
              {ultimo ? "¡Listo!" : "Siguiente"}
            </Boton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
