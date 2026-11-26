import { useState } from "react";
import { SelectorFecha } from "finanzas-frontend";

export function Basico() {
  const [fecha, setFecha] = useState("2026-11-26");
  return (
    <div style={{ maxWidth: 320 }}>
      <SelectorFecha etiqueta="Fecha del movimiento" valor={fecha} onCambiar={setFecha} />
    </div>
  );
}

export function OpcionalConAyuda() {
  const [fecha, setFecha] = useState("");
  return (
    <div style={{ maxWidth: 320 }}>
      <SelectorFecha etiqueta="Fecha límite" valor={fecha} onCambiar={setFecha} opcional ayuda="Déjala vacía si la meta no tiene fecha." />
    </div>
  );
}
