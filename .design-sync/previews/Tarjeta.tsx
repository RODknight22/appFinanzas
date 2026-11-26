import { Boton, Tarjeta } from "finanzas-frontend";

export function Basica() {
  return (
    <div style={{ maxWidth: 380 }}>
      <Tarjeta titulo="Balance global">
        <p style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, color: "var(--texto)" }}>2.418,60 €</p>
        <p style={{ fontSize: 13, margin: "4px 0 0", color: "var(--tenue)" }}>≈ 49.351,20 MXN · todas tus cuentas</p>
      </Tarjeta>
    </div>
  );
}

export function ConAccion() {
  return (
    <div style={{ maxWidth: 420 }}>
      <Tarjeta titulo="Presupuesto de noviembre" accion={<Boton variante="fantasma">Editar</Boton>}>
        <p style={{ fontSize: 14, margin: 0, color: "var(--suave)" }}>Comida: 412,00 € de 500,00 €. Quedan 9 días del mes.</p>
      </Tarjeta>
    </div>
  );
}
