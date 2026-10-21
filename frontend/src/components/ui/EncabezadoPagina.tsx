import type { ReactNode } from "react";

import { Consejo } from "./Consejo";

interface EncabezadoPaginaProps {
  titulo: string;
  descripcion?: string;
  /** Consejo de uso de la página (bombilla junto al título). */
  consejo?: string;
  /** Botones o controles a la derecha (en móvil bajan debajo del título). */
  acciones?: ReactNode;
}

export function EncabezadoPagina({ titulo, descripcion, consejo, acciones }: EncabezadoPaginaProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          {titulo}
          {consejo && <Consejo texto={consejo} />}
        </h1>
        {descripcion && <p className="mt-1 text-sm text-tenue">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}
