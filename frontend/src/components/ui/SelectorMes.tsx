import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";

import { usePanelFlotante } from "../../hooks/usePanelFlotante";
import type { MesAnio } from "../../types";
import { formatearMes, mesActual, nombreMesCorto, textoRangoMes } from "../../utils/formato";

const ANCHO_PANEL = 264;

/** Suma (o resta) meses a un "YYYY-MM". */
function desplazarMes(mes: MesAnio, delta: number): MesAnio {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const fecha = new Date(anio, numeroMes - 1 + delta, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

interface SelectorMesProps {
  mes: MesAnio;
  onCambiar: (mes: MesAnio) => void;
}

/**
 * Flechas ‹ › para moverse entre meses. Al tocar el nombre del mes se abre una
 * cuadrícula para saltar a cualquier mes y año, y "Hoy" vuelve al mes en curso.
 */
export function SelectorMes({ mes, onCambiar }: SelectorMesProps) {
  const [abierto, setAbierto] = useState(false);
  const refBoton = useRef<HTMLButtonElement>(null);
  const rango = textoRangoMes(mes);
  const actual = mesActual();
  const claseFlecha = "rounded-full p-1.5 text-tenue hover:bg-realce hover:text-texto";

  function cerrar() {
    setAbierto(false);
    refBoton.current?.focus();
  }

  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-full bg-superficie-2 px-1 py-1 ring-1 ring-linea">
        <button type="button" className={claseFlecha} onClick={() => onCambiar(desplazarMes(mes, -1))} aria-label="Mes anterior">
          <ChevronLeft size={18} />
        </button>
        <button
          ref={refBoton}
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          aria-label={`${formatearMes(mes)}: elegir otro mes`}
          className="min-w-36 rounded-full px-2 py-0.5 text-center transition-colors hover:bg-realce"
        >
          <span className="block text-sm font-medium">{formatearMes(mes)}</span>
          {/* Con un mes financiero (p. ej. del 15 al 14) mostramos las fechas reales */}
          {rango && <span className="block text-[11px] leading-tight text-tenue">{rango}</span>}
        </button>
        <button type="button" className={claseFlecha} onClick={() => onCambiar(desplazarMes(mes, 1))} aria-label="Mes siguiente">
          <ChevronRight size={18} />
        </button>
      </div>
      {/* Solo cuando hace falta: en el mes en curso no aporta nada */}
      {mes !== actual && (
        <button
          type="button"
          onClick={() => onCambiar(actual)}
          aria-label="Volver al mes actual"
          className="animate-entrada rounded-full bg-superficie-2 px-3 py-1.5 text-xs font-semibold text-acento-600 ring-1 ring-linea transition-colors hover:bg-realce dark:text-acento-400"
        >
          Hoy
        </button>
      )}
      {abierto && (
        <PanelMeses
          disparador={refBoton}
          mes={mes}
          actual={actual}
          onElegir={(elegido) => {
            onCambiar(elegido);
            cerrar();
          }}
          onCerrar={cerrar}
        />
      )}
    </div>
  );
}

interface PanelMesesProps {
  disparador: RefObject<HTMLButtonElement | null>;
  mes: MesAnio;
  actual: MesAnio;
  onElegir: (mes: MesAnio) => void;
  onCerrar: () => void;
}

/** Cuadrícula de 12 meses con el año arriba. Se monta al abrirla: empieza en el año del mes elegido. */
function PanelMeses({ disparador, mes, actual, onElegir, onCerrar }: PanelMesesProps) {
  const [anio, setAnio] = useState(Number(mes.slice(0, 4)));
  const refPanel = useRef<HTMLDivElement>(null);
  const posicion = usePanelFlotante(disparador, refPanel, ANCHO_PANEL, onCerrar);
  const visible = posicion !== null;

  // Al abrir, el foco va al mes elegido: así el teclado empieza donde estás.
  useEffect(() => {
    if (visible) refPanel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, [visible]);

  function alTeclear(evento: KeyboardEvent) {
    if (evento.key === "Escape") {
      evento.stopPropagation(); // que no cierre también un modal
      onCerrar();
    }
  }

  const claseFlecha = "rounded-full p-1.5 text-acento-600 transition-colors hover:bg-realce dark:text-acento-400";

  return createPortal(
    <div
      ref={refPanel}
      role="dialog"
      aria-label="Elegir mes"
      onKeyDown={alTeclear}
      className="fixed z-[60] animate-entrada rounded-2xl bg-superficie p-3 shadow-2xl ring-1 ring-linea"
      style={{ top: posicion?.top ?? 0, left: posicion?.left ?? 0, width: posicion?.ancho ?? ANCHO_PANEL, visibility: visible ? "visible" : "hidden" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setAnio(anio - 1)} aria-label="Año anterior" className={claseFlecha}>
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-bold tabular-nums" aria-live="polite">{anio}</span>
        <button type="button" onClick={() => setAnio(anio + 1)} aria-label="Año siguiente" className={claseFlecha}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((numero) => {
          const codigo: MesAnio = `${anio}-${String(numero).padStart(2, "0")}`;
          const elegido = codigo === mes;
          return (
            <button
              key={numero}
              type="button"
              onClick={() => onElegir(codigo)}
              aria-label={formatearMes(codigo)}
              aria-pressed={elegido}
              aria-current={codigo === actual ? "date" : undefined}
              className={`rounded-xl py-2.5 text-sm font-medium capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acento-500 ${
                elegido
                  ? "bg-acento-600 text-white"
                  : codigo === actual
                    ? "font-bold text-acento-600 hover:bg-realce dark:text-acento-400"
                    : "hover:bg-realce"
              }`}
            >
              {nombreMesCorto(numero)}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
