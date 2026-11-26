import { LogoOrvyn } from "finanzas-frontend";

export function Tamanos() {
  return (
    <div style={{ display: "grid", gap: 20, justifyItems: "start" }}>
      <LogoOrvyn tamano={20} />
      <LogoOrvyn />
      <LogoOrvyn tamano={40} />
    </div>
  );
}
