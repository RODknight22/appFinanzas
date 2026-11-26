import { Avatar } from "finanzas-frontend";

const fila = { display: "flex", gap: 16, alignItems: "center" };

export function Inicial() {
  return (
    <div style={fila}>
      <Avatar avatar={null} nombre="Rodrigo" />
      <Avatar avatar={null} nombre="Lucía" tamano="lg" />
    </div>
  );
}

export function Emoji() {
  return (
    <div style={fila}>
      <Avatar avatar="🦊" nombre="Rodrigo" />
      <Avatar avatar="🚀" nombre="Rodrigo" tamano="lg" />
    </div>
  );
}
