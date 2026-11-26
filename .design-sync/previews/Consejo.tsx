import { Consejo } from "finanzas-frontend";

export function JuntoAUnTitulo() {
  return (
    <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 18, fontWeight: 600, margin: 0, color: "var(--texto)" }}>
      Presupuestos
      <Consejo texto="Pon un límite por categoría y mes. Te avisamos al llegar al 85 %." />
    </p>
  );
}
