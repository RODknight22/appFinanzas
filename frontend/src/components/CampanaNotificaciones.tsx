import {
  Bell,
  CalendarClock,
  CreditCard,
  Gift,
  Handshake,
  HandCoins,
  PencilLine,
  PiggyBank,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import type { EstadoNotificaciones } from "../hooks/useNotificaciones";
import type { Notificacion, TipoNotificacion } from "../types";
import { formatearDinero } from "../utils/formato";

const ICONOS: Record<TipoNotificacion, LucideIcon> = {
  pago: CalendarClock,
  cobro: HandCoins,
  tarjeta: CreditCard,
  deuda: Handshake,
  presupuesto: PiggyBank,
  meta: Target,
  deseo: Gift,
  recordatorio: PencilLine,
};

/**
 * Campana con los avisos (pagos próximos, presupuestos, metas, deseos…).
 * Los datos vienen de `useNotificaciones` (una sola carga para las dos campanas
 * del Layout); el panel se pinta en <body> para que ningún contenedor lo recorte.
 */
export function CampanaNotificaciones({ avisos, marcarLeidas }: EstadoNotificaciones) {
  const [abierta, setAbierta] = useState(false);
  const refBoton = useRef<HTMLButtonElement>(null);
  const refPanel = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!abierta) return;
    const alPulsar = (evento: MouseEvent) => {
      const objetivo = evento.target as Node;
      if (!refPanel.current?.contains(objetivo) && !refBoton.current?.contains(objetivo)) setAbierta(false);
    };
    const alTeclear = (evento: KeyboardEvent) => evento.key === "Escape" && setAbierta(false);
    document.addEventListener("mousedown", alPulsar, true);
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alPulsar, true);
      window.removeEventListener("keydown", alTeclear);
    };
  }, [abierta]);

  const sinLeer = avisos.filter((a) => !a.leida);

  function abrirAviso(aviso: Notificacion) {
    marcarLeidas([aviso.clave]);
    setAbierta(false);
    navigate(aviso.enlace);
  }

  return (
    <>
      <button
        ref={refBoton}
        type="button"
        onClick={() => setAbierta((a) => !a)}
        aria-label={sinLeer.length ? `Notificaciones (${sinLeer.length} sin leer)` : "Notificaciones"}
        aria-expanded={abierta}
        className="relative rounded-full p-2 text-tenue transition-colors hover:bg-realce hover:text-texto"
      >
        <Bell size={18} />
        {sinLeer.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {sinLeer.length > 9 ? "9+" : sinLeer.length}
          </span>
        )}
      </button>

      {abierta &&
        createPortal(
          <div
            ref={refPanel}
            role="dialog"
            aria-label="Notificaciones"
            className="fixed inset-x-2 top-16 z-50 max-h-[75vh] animate-entrada overflow-y-auto rounded-2xl bg-superficie p-2 shadow-2xl ring-1 ring-linea md:inset-x-auto md:top-4 md:left-64 md:w-96"
          >
            <header className="flex items-center justify-between px-2 py-1.5">
              <h2 className="text-sm font-semibold">Notificaciones</h2>
              {sinLeer.length > 0 && (
                <button type="button" onClick={() => marcarLeidas(sinLeer.map((a) => a.clave))} className="text-xs font-medium text-acento-600 hover:underline dark:text-acento-400">
                  Marcar todo como leído
                </button>
              )}
            </header>
            {avisos.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-tenue">Todo en orden: nada pendiente 🎉</p>
            ) : (
              <ul>
                {avisos.map((aviso) => {
                  const Icono = ICONOS[aviso.tipo];
                  return (
                    <li key={aviso.clave}>
                      <button
                        type="button"
                        onClick={() => abrirAviso(aviso)}
                        className={`flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-realce ${aviso.leida ? "opacity-60" : ""}`}
                      >
                        <span
                          className={`mt-0.5 rounded-lg p-1.5 ${
                            aviso.urgente ? "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400" : "bg-superficie-2 text-acento-600 dark:text-acento-400"
                          }`}
                        >
                          <Icono size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{aviso.titulo}</span>
                          <span className="block text-xs text-tenue">{aviso.mensaje}</span>
                        </span>
                        {aviso.monto !== null && aviso.moneda !== null && (
                          <span className="shrink-0 text-xs font-semibold tabular-nums">{formatearDinero(aviso.monto, aviso.moneda)}</span>
                        )}
                        {!aviso.leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-acento-500" aria-label="Sin leer" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
