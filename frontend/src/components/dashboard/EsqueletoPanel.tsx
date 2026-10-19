/** Bloques grises con la forma del panel mientras llegan los datos (primera carga). */
const BLOQUES = [
  "col-span-2 h-40",
  "col-span-1 h-40",
  "col-span-1 h-40",
  "col-span-2 h-64 lg:col-span-3",
  "col-span-2 h-64 lg:col-span-1",
  "col-span-2 h-72",
  "col-span-2 h-72",
];

export function EsqueletoPanel() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-busy="true" aria-label="Cargando el panel">
      {BLOQUES.map((clase, i) => (
        <div key={i} className={`animate-pulse rounded-3xl bg-superficie ring-1 ring-linea ${clase}`} />
      ))}
    </div>
  );
}
