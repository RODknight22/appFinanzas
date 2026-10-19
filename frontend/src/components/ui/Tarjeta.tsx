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
      className={`rounded-3xl bg-superficie p-5 shadow-[var(--sombra)] ring-1 ring-linea ${className}`}
    >
      {(titulo || accion) && (
        <header className="mb-4 flex items-center justify-between gap-2">
          {titulo && (
            <h2 className="text-sm font-semibold text-tenue">{titulo}</h2>
          )}
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}
