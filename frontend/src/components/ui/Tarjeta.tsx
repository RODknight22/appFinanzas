import type { ReactNode } from "react";

interface TarjetaProps {
  titulo?: string;
  /** Contenido a la derecha del título (p. ej. un botón). */
  accion?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Contenedor con borde y fondo: la "caja" base de toda la interfaz. */
export function Tarjeta({ titulo, accion, className = "", children }: TarjetaProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {(titulo || accion) && (
        <header className="mb-4 flex items-center justify-between gap-2">
          {titulo && (
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">{titulo}</h2>
          )}
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}
