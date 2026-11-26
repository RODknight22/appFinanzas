/**
 * Logo de ORVYN. El símbolo ("Foundation") son tres niveles apilados que suben hacia la
 * derecha: la estabilidad se construye nivel a nivel. Va siempre en Saffron (`marca`), sea
 * cual sea el acento elegido: la marca es la misma aunque cambie el color de la app.
 *
 * Provisional: es la base para diseñar el logo final. Si cambia, cambia solo aquí y en
 * public/favicon.svg.
 */
export function SimboloOrvyn({ tamano = 24, className = "" }: { tamano?: number; className?: string }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 64 64" aria-hidden="true" className={`shrink-0 fill-marca ${className}`}>
      {/* Tres niveles de 16 de alto con huecos de 8; cada uno descansa sobre el anterior */}
      <rect x="0" y="48" width="64" height="16" rx="2" />
      <rect x="20" y="24" width="44" height="16" rx="2" />
      <rect x="40" y="0" width="24" height="16" rx="2" />
    </svg>
  );
}

/** Símbolo + nombre, para la barra lateral y la pantalla de acceso. */
export function LogoOrvyn({ tamano = 24, className = "" }: { tamano?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <SimboloOrvyn tamano={tamano} />
      <span className="font-display font-extrabold tracking-[0.06em] text-texto" style={{ fontSize: tamano * 0.85 }}>
        ORVYN
      </span>
    </span>
  );
}
