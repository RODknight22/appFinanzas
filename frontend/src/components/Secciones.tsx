import { Banknote, Gift, HandCoins, Repeat, Target, Wallet } from "lucide-react";

import { SeccionConPestanas } from "./ui/SeccionConPestanas";

/*
 * Páginas que comparten entrada en el menú. Siguen siendo páginas separadas, cada una
 * con su ruta: así el menú es más corto y lo parecido queda junto.
 */

export function SeccionCuentas() {
  return (
    <SeccionConPestanas
      nombre="Secciones de cuentas"
      pestanas={[
        { ruta: "/cuentas", etiqueta: "Cuentas", icono: Wallet },
        { ruta: "/cuentas/efectivo", etiqueta: "Efectivo", icono: Banknote },
      ]}
    />
  );
}

export function SeccionMetas() {
  return (
    <SeccionConPestanas
      nombre="Secciones de metas"
      pestanas={[
        { ruta: "/metas", etiqueta: "Metas", icono: Target },
        { ruta: "/metas/deseos", etiqueta: "Deseos", icono: Gift },
      ]}
    />
  );
}

export function SeccionPagosFijos() {
  return (
    <SeccionConPestanas
      nombre="Secciones de pagos fijos"
      pestanas={[
        { ruta: "/pagos-fijos", etiqueta: "Suscripciones", icono: Repeat },
        { ruta: "/pagos-fijos/ingresos", etiqueta: "Ingresos fijos", icono: HandCoins },
      ]}
    />
  );
}
