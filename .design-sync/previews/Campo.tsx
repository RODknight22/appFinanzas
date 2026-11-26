import { CLASE_ENTRADA, Campo, ErrorFormulario } from "finanzas-frontend";

const columna = { display: "grid", gap: 16, maxWidth: 360 };

export function Texto() {
  return (
    <div style={columna}>
      <Campo etiqueta="Concepto">
        <input className={CLASE_ENTRADA} defaultValue="Mercadona" />
      </Campo>
      <Campo etiqueta="Importe" ayuda="En la moneda de la cuenta (EUR). Se convierte a MXN con la tasa del día.">
        <input className={CLASE_ENTRADA} inputMode="decimal" defaultValue="34,90" />
      </Campo>
    </div>
  );
}

export function Selector() {
  return (
    <div style={columna}>
      <Campo etiqueta="Cuenta">
        <select className={CLASE_ENTRADA} defaultValue="revolut">
          <option value="revolut">Revolut (EUR)</option>
          <option value="bbva">BBVA México (MXN)</option>
        </select>
      </Campo>
    </div>
  );
}

export function ConError() {
  return (
    <div style={columna}>
      <Campo etiqueta="Importe">
        <input className={CLASE_ENTRADA} defaultValue="treinta" />
      </Campo>
      <ErrorFormulario mensaje="El importe debe ser un número mayor que 0." />
    </div>
  );
}
