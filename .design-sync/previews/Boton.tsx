import { Download, Plus, Trash2 } from "lucide-react";
import { Boton } from "finanzas-frontend";

const fila = { display: "flex", flexWrap: "wrap" as const, gap: 12, alignItems: "center" };

export function Variantes() {
  return (
    <div style={fila}>
      <Boton>Guardar movimiento</Boton>
      <Boton variante="secundario">Importar extracto</Boton>
      <Boton variante="fantasma">Cancelar</Boton>
      <Boton variante="peligro">Borrar cuenta</Boton>
    </div>
  );
}

export function ConIcono() {
  return (
    <div style={fila}>
      <Boton><Plus size={16} /> Añadir movimiento</Boton>
      <Boton variante="secundario"><Download size={16} /> Descargar copia</Boton>
      <Boton variante="fantasma"><Trash2 size={16} /> Quitar filtro</Boton>
    </div>
  );
}

export function Deshabilitado() {
  return (
    <div style={fila}>
      <Boton disabled>Guardando…</Boton>
      <Boton variante="secundario" disabled>Sin cambios</Boton>
    </div>
  );
}
