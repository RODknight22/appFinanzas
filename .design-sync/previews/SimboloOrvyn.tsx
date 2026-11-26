import { SimboloOrvyn } from "finanzas-frontend";

export function Tamanos() {
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "end" }}>
      <SimboloOrvyn tamano={16} />
      <SimboloOrvyn tamano={24} />
      <SimboloOrvyn tamano={44} />
      <SimboloOrvyn tamano={64} />
    </div>
  );
}
