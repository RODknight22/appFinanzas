import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";

import type { FechaISO } from "../../types";
import { aISO, fechaLocal, formatearFecha, formatearMes, hoyISO, nombreMesCorto, sumarDias } from "../../utils/formato";
import { CLASE_ENTRADA } from "./Campo";

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const ANCHO_PANEL = 288;
const MARGEN = 8; // distancia mínima a los bordes de la ventana
const SEPARACION = 6; // entre el campo y el calendario

/** Suma meses conservando el día si existe: 31 oct + 1 mes = 30 nov. */
function sumarMeses(fecha: FechaISO, meses: number): FechaISO {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const ultimoDia = new Date(anio, mes - 1 + meses + 1, 0).getDate();
  return aISO(new Date(anio, mes - 1 + meses, Math.min(dia, ultimoDia)));
}

/** Lunes = 0 … domingo = 6. */
function diaDeSemana(fecha: FechaISO): number {
  return (fechaLocal(fecha).getDay() + 6) % 7;
}

/** "Hoy, 21 oct 2026", "Ayer, …" o solo la fecha. */
function textoFecha(fecha: FechaISO): string {
  const hoy = hoyISO();
  const relativo = { [hoy]: "Hoy", [sumarDias(hoy, -1)]: "Ayer", [sumarDias(hoy, 1)]: "Mañana" }[fecha];
  return relativo ? `${relativo}, ${formatearFecha(fecha)}` : formatearFecha(fecha);
}

interface SelectorFechaProps {
  etiqueta: string;
  /** "" = sin fecha (solo tiene sentido si es opcional). */
  valor: FechaISO;
  onCambiar: (fecha: FechaISO) => void;
  opcional?: boolean;
  ayuda?: string;
}

/**
 * Campo de fecha con un calendario al estilo del de iOS: se abre con un toque,
 * se cambia de mes con las flechas o tocando la cabecera (cuadrícula de meses)
 * y tiene atajos para ayer, hoy y mañana. Elegir un día lo cierra.
 *
 * No se envuelve en el <label> de Campo: un clic en un hueco del calendario
 * "activaría" la etiqueta y volvería a pulsar el campo, cerrándolo.
 */
export function SelectorFecha({ etiqueta, valor, onCambiar, opcional = false, ayuda }: SelectorFechaProps) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const refBoton = useRef<HTMLButtonElement>(null);

  function cerrar() {
    setAbierto(false);
    refBoton.current?.focus();
  }

  function elegir(fecha: FechaISO) {
    onCambiar(fecha);
    cerrar();
  }

  return (
    <div className="space-y-1">
      <div className="space-y-1.5">
        <span id={`${id}-etiqueta`} className="block text-sm font-medium text-suave">{etiqueta}</span>
        <button
          ref={refBoton}
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-labelledby={`${id}-etiqueta ${id}-valor`}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          className={`${CLASE_ENTRADA} flex items-center gap-2 text-left`}
        >
          <CalendarDays size={16} className="shrink-0 text-tenue" />
          <span id={`${id}-valor`} className={`truncate ${valor ? "" : "text-tenue-2"}`}>
            {valor ? textoFecha(valor) : "Sin fecha"}
          </span>
        </button>
      </div>
      {ayuda && <p className="text-xs text-tenue">{ayuda}</p>}
      {abierto && (
        <PanelCalendario
          disparador={refBoton}
          etiqueta={etiqueta}
          valor={valor}
          opcional={opcional}
          onElegir={elegir}
          onCerrar={cerrar}
        />
      )}
    </div>
  );
}

interface PanelCalendarioProps {
  disparador: RefObject<HTMLButtonElement | null>;
  etiqueta: string;
  valor: FechaISO;
  opcional: boolean;
  onElegir: (fecha: FechaISO) => void;
  onCerrar: () => void;
}

/** El calendario flotante. Se monta al abrirlo, así cada vez empieza en la fecha elegida. */
function PanelCalendario({ disparador, etiqueta, valor, opcional, onElegir, onCerrar }: PanelCalendarioProps) {
  const hoy = hoyISO();
  // Día con el foco: decide qué mes se ve y se mueve con las flechas del teclado.
  const [enfocada, setEnfocada] = useState(valor || hoy);
  const [vista, setVista] = useState<"dias" | "meses">("dias");
  const [posicion, setPosicion] = useState<{ top: number; left: number; ancho: number } | null>(null);
  const refPanel = useRef<HTMLDivElement>(null);

  // Debajo del campo; encima si abajo no cabe. Se recoloca al hacer scroll (el modal también se desplaza).
  useLayoutEffect(() => {
    function colocar() {
      const boton = disparador.current;
      const panel = refPanel.current;
      if (!boton || !panel) return;
      const rect = boton.getBoundingClientRect();
      const ancho = Math.min(ANCHO_PANEL, window.innerWidth - 2 * MARGEN);
      const alto = panel.offsetHeight;
      const left = Math.min(Math.max(MARGEN, rect.left), window.innerWidth - ancho - MARGEN);
      const cabeAbajo = rect.bottom + SEPARACION + alto <= window.innerHeight - MARGEN;
      const cabeArriba = rect.top - SEPARACION - alto >= MARGEN;
      const top = cabeAbajo || !cabeArriba ? rect.bottom + SEPARACION : rect.top - SEPARACION - alto;
      setPosicion({ top, left, ancho });
    }
    colocar();
    window.addEventListener("resize", colocar);
    window.addEventListener("scroll", colocar, true);
    return () => {
      window.removeEventListener("resize", colocar);
      window.removeEventListener("scroll", colocar, true);
    };
  }, [disparador, vista]);

  // Un clic fuera (ni en el calendario ni en el campo) lo cierra sin cambiar nada.
  // En captura: el modal detiene la propagación de sus clics y no llegarían al document.
  useEffect(() => {
    function alPulsar(evento: MouseEvent) {
      const objetivo = evento.target as Node;
      if (!refPanel.current?.contains(objetivo) && !disparador.current?.contains(objetivo)) onCerrar();
    }
    document.addEventListener("mousedown", alPulsar, true);
    return () => document.removeEventListener("mousedown", alPulsar, true);
  }, [disparador, onCerrar]);

  // El foco sigue al día enfocado (para el teclado), una vez el panel ya es visible.
  const visible = posicion !== null;
  useEffect(() => {
    if (!visible || vista !== "dias") return;
    refPanel.current?.querySelector<HTMLButtonElement>(`[data-fecha="${enfocada}"]`)?.focus({ preventScroll: true });
  }, [visible, vista, enfocada]);

  function alTeclear(evento: KeyboardEvent) {
    if (evento.key === "Escape") {
      evento.stopPropagation(); // que no cierre también el modal
      onCerrar();
      return;
    }
    if (vista !== "dias") return;
    const pasos: Record<string, () => FechaISO> = {
      ArrowLeft: () => sumarDias(enfocada, -1),
      ArrowRight: () => sumarDias(enfocada, 1),
      ArrowUp: () => sumarDias(enfocada, -7),
      ArrowDown: () => sumarDias(enfocada, 7),
      PageUp: () => sumarMeses(enfocada, -1),
      PageDown: () => sumarMeses(enfocada, 1),
      Home: () => sumarDias(enfocada, -diaDeSemana(enfocada)),
      End: () => sumarDias(enfocada, 6 - diaDeSemana(enfocada)),
    };
    const paso = pasos[evento.key];
    if (paso) {
      evento.preventDefault();
      setEnfocada(paso());
    }
  }

  const mesVisible = enfocada.slice(0, 7);
  const anio = Number(enfocada.slice(0, 4));
  const primerDia = `${mesVisible}-01`;
  const diasDelMes = Number(sumarDias(sumarMeses(primerDia, 1), -1).slice(8));
  const dias = Array.from({ length: diasDelMes }, (_, i) => `${mesVisible}-${String(i + 1).padStart(2, "0")}`);
  // Las flechas mueven un mes en la vista de días y un año en la de meses.
  const salto = vista === "dias" ? 1 : 12;

  const claseFlecha = "rounded-full p-1.5 text-acento-600 transition-colors hover:bg-realce dark:text-acento-400";
  const claseAtajo = "rounded-full bg-superficie-2 px-3 py-1 text-xs font-semibold text-suave transition-colors hover:bg-realce hover:text-texto";

  return createPortal(
    <div
      ref={refPanel}
      role="dialog"
      aria-label={`Elegir ${etiqueta.toLowerCase()}`}
      onKeyDown={alTeclear}
      className="fixed z-[60] animate-entrada rounded-2xl bg-superficie p-3 shadow-2xl ring-1 ring-linea"
      // Oculto hasta medirlo: así no aparece un instante en la esquina.
      style={{ top: posicion?.top ?? 0, left: posicion?.left ?? 0, width: posicion?.ancho ?? ANCHO_PANEL, visibility: visible ? "visible" : "hidden" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setVista((v) => (v === "dias" ? "meses" : "dias"))}
          aria-expanded={vista === "meses"}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold transition-colors hover:bg-realce"
        >
          {vista === "dias" ? formatearMes(mesVisible) : anio}
          <ChevronDown size={16} className={`text-acento-600 transition-transform dark:text-acento-400 ${vista === "meses" ? "rotate-180" : ""}`} />
        </button>
        <div className="flex">
          <button type="button" onClick={() => setEnfocada(sumarMeses(enfocada, -salto))} aria-label={vista === "dias" ? "Mes anterior" : "Año anterior"} className={claseFlecha}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setEnfocada(sumarMeses(enfocada, salto))} aria-label={vista === "dias" ? "Mes siguiente" : "Año siguiente"} className={claseFlecha}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {vista === "dias" ? (
        <div className="grid grid-cols-7 gap-y-0.5 text-center">
          {DIAS_SEMANA.map((letra) => (
            <span key={letra} className="pb-1 text-[11px] font-semibold text-tenue-2">{letra}</span>
          ))}
          {Array.from({ length: diaDeSemana(primerDia) }, (_, i) => <span key={`hueco-${i}`} />)}
          {dias.map((dia) => {
            const elegido = dia === valor;
            const esHoy = dia === hoy;
            return (
              <button
                key={dia}
                type="button"
                data-fecha={dia}
                tabIndex={dia === enfocada ? 0 : -1}
                onClick={() => onElegir(dia)}
                aria-label={formatearFecha(dia)}
                aria-pressed={elegido}
                aria-current={esHoy ? "date" : undefined}
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acento-500 ${
                  elegido
                    ? "bg-acento-600 font-semibold text-white"
                    : esHoy
                      ? "font-bold text-acento-600 hover:bg-realce dark:text-acento-400"
                      : "hover:bg-realce"
                }`}
              >
                {Number(dia.slice(8))}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => {
            const codigo = `${anio}-${String(mes).padStart(2, "0")}`;
            const actual = codigo === mesVisible;
            return (
              <button
                key={mes}
                type="button"
                onClick={() => {
                  setEnfocada(sumarMeses(enfocada, mes - Number(enfocada.slice(5, 7))));
                  setVista("dias");
                }}
                aria-pressed={actual}
                className={`rounded-xl py-2.5 text-sm font-medium capitalize transition-colors ${
                  actual ? "bg-acento-600 text-white" : codigo === hoy.slice(0, 7) ? "text-acento-600 hover:bg-realce dark:text-acento-400" : "hover:bg-realce"
                }`}
              >
                {nombreMesCorto(mes)}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-linea pt-2.5">
        <button type="button" onClick={() => onElegir(sumarDias(hoy, -1))} className={claseAtajo}>Ayer</button>
        <button type="button" onClick={() => onElegir(hoy)} className={claseAtajo}>Hoy</button>
        <button type="button" onClick={() => onElegir(sumarDias(hoy, 1))} className={claseAtajo}>Mañana</button>
        {opcional && valor && (
          <button type="button" onClick={() => onElegir("")} className={`${claseAtajo} ml-auto`}>Quitar</button>
        )}
      </div>
    </div>,
    document.body,
  );
}
