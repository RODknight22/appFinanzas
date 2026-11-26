import { Plus } from "lucide-react";
import { Boton, EncabezadoPagina } from "finanzas-frontend";

export function Basico() {
  return <EncabezadoPagina titulo="Cuentas" descripcion="Tus cuentas en cada moneda y su equivalente en la principal" />;
}

export function ConConsejoYAcciones() {
  return (
    <EncabezadoPagina
      titulo="Transacciones"
      descripcion="Noviembre de 2026"
      consejo="Cada movimiento guarda su valor en la moneda de la cuenta y en la principal, con la tasa de su fecha."
      acciones={
        <>
          <Boton variante="secundario">Importar extracto</Boton>
          <Boton><Plus size={16} /> Añadir</Boton>
        </>
      }
    />
  );
}
