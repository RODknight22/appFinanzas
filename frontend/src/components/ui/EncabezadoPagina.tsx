import type { ReactNode } from "react";

interface EncabezadoPaginaProps {
  titulo: string;
  descripcion?: string;
  /** Botones o controles a la derecha (en móvil bajan debajo del título). */
  acciones?: ReactNode;
}

export function EncabezadoPagina({ titulo, descripcion, acciones }: EncabezadoPaginaProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-slate-500">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}
