import { Boton, CLASE_ENTRADA, Campo, Modal } from "finanzas-frontend";

export function Abierto() {
  return (
    <Modal titulo="Nueva cuenta" abierto onCerrar={() => {}}>
      <div style={{ display: "grid", gap: 16 }}>
        <Campo etiqueta="Nombre">
          <input className={CLASE_ENTRADA} defaultValue="Revolut" />
        </Campo>
        <Campo etiqueta="Moneda">
          <select className={CLASE_ENTRADA} defaultValue="EUR">
            <option value="EUR">EUR · Euro</option>
            <option value="MXN">MXN · Peso mexicano</option>
          </select>
        </Campo>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Boton variante="fantasma">Cancelar</Boton>
          <Boton>Crear cuenta</Boton>
        </div>
      </div>
    </Modal>
  );
}
