import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Boton } from "./Boton";

export function Cargando() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 size={18} className="animate-spin" /> Cargando…
    </div>
  );
}

export function MensajeError({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-rose-600 dark:text-rose-400">
      <AlertTriangle size={24} />
      <p>{mensaje}</p>
      {onReintentar && (
        <Boton variante="secundario" onClick={onReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}

export function Vacio({ mensaje, accion }: { mensaje: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-slate-500">
      <Inbox size={28} className="text-slate-400" />
      <p>{mensaje}</p>
      {accion}
    </div>
  );
}

interface ContenidoProps<T> {
  cargando: boolean;
  error: string | null;
  datos: T | undefined;
  onReintentar: () => void;
  children: (datos: T) => ReactNode;
}

/**
 * Muestra "cargando", el error o el contenido según el estado de useDatos.
 * Evita repetir los mismos `if` en cada página.
 */
export function Contenido<T>({ cargando, error, datos, onReintentar, children }: ContenidoProps<T>) {
  if (error) return <MensajeError mensaje={error} onReintentar={onReintentar} />;
  if (cargando && datos === undefined) return <Cargando />;
  if (datos === undefined) return null;
  return <>{children(datos)}</>;
}
