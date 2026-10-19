import { useId } from "react";

interface SparklineProps {
  valores: number[];
  className?: string;
}

/**
 * Mini-gráfica de tendencia en SVG puro (sin Recharts: son pocas líneas y no pesa).
 * Usa `currentColor`: el color lo decide la clase de texto del contenedor.
 */
export function Sparkline({ valores, className = "" }: SparklineProps) {
  // useId: cada degradado necesita un id único aunque haya varias en la página.
  // useId da ":r1:"; los ":" no son válidos dentro de url(#…) en todos los navegadores.
  const id = useId().replace(/:/g, "");
  if (valores.length < 2) return null;

  const ANCHO = 100;
  const ALTO = 32;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1; // si todos son iguales, una línea plana en medio
  const puntos = valores.map((valor, i) => {
    const x = (i / (valores.length - 1)) * ANCHO;
    const y = ALTO - 2 - ((valor - min) / rango) * (ALTO - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linea = `M${puntos.join(" L")}`;

  return (
    // preserveAspectRatio="none": se estira al ancho de la tarjeta.
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="none" className={`h-8 w-full overflow-visible ${className}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.3} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${linea} L${ANCHO},${ALTO} L0,${ALTO} Z`} fill={`url(#${id})`} />
      <path d={linea} fill="none" stroke="currentColor" strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
