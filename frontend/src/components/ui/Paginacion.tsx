import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginacionProps {
  pagina: number;
  porPagina: number;
  total: number;
  onCambiar: (pagina: number) => void;
}

/** "51–100 de 230" con flechas. No se muestra si todo cabe en una página. */
export function Paginacion({ pagina, porPagina, total, onCambiar }: PaginacionProps) {
  const paginas = Math.ceil(total / porPagina);
  if (paginas <= 1) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  const claseFlecha =
    "rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-slate-800 dark:hover:text-slate-100";

  return (
    <nav className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm text-slate-500 dark:border-slate-800" aria-label="Paginación">
      <span className="tabular-nums">{desde}–{hasta} de {total}</span>
      <div className="flex items-center gap-1">
        <button type="button" className={claseFlecha} onClick={() => onCambiar(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior">
          <ChevronLeft size={18} />
        </button>
        <span className="tabular-nums">{pagina} / {paginas}</span>
        <button type="button" className={claseFlecha} onClick={() => onCambiar(pagina + 1)} disabled={pagina >= paginas} aria-label="Página siguiente">
          <ChevronRight size={18} />
        </button>
      </div>
    </nav>
  );
}
