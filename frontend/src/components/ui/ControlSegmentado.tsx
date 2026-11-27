import type { ReactNode } from "react";

export interface OpcionSegmentada<T> {
  valor: T;
  etiqueta: ReactNode;
  /** Relleno propio de la opción elegida (p. ej. rojo para "Gasto"); por defecto, una píldora clara. */
  claseActiva?: string;
}

interface ControlSegmentadoProps<T> {
  opciones: OpcionSegmentada<T>[];
  valor: T;
  onCambiar: (valor: T) => void;
  /** Lo que el lector de pantalla anuncia al entrar en el grupo: "Tipo de deuda". */
  etiqueta: string;
  /** "completo": ocupa todo el ancho a partes iguales (formularios). "compacto": solo lo que mide. */
  ancho?: "completo" | "compacto";
  className?: string;
}

const ACTIVA_POR_DEFECTO = "bg-superficie text-texto shadow-[var(--sombra)]";

/**
 * Elegir una opción entre pocas (gasto/ingreso, aportar/retirar…) con botones-píldora.
 * Cada botón dice si está pulsado (aria-pressed) y el grupo tiene nombre (role="group").
 */
export function ControlSegmentado<T extends string | number | boolean>({
  opciones,
  valor,
  onCambiar,
  etiqueta,
  ancho = "completo",
  className = "",
}: ControlSegmentadoProps<T>) {
  const completo = ancho === "completo";
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={`${completo ? "flex" : "inline-flex"} rounded-full bg-superficie-2 p-1 ${className}`}
    >
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <button
            key={String(opcion.valor)}
            type="button"
            onClick={() => onCambiar(opcion.valor)}
            aria-pressed={activa}
            className={`rounded-full text-sm font-semibold ${completo ? "flex-1 py-2" : "px-3.5 py-1.5"} ${
              activa ? (opcion.claseActiva ?? ACTIVA_POR_DEFECTO) : "text-tenue hover:text-texto"
            }`}
          >
            {opcion.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
