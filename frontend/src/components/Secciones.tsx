import { Banknote, Coins, Gift, HandCoins, Palette, Repeat, ShieldCheck, Target, UserRound, Wallet } from "lucide-react";

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

export function SeccionAjustes() {
  return (
    <SeccionConPestanas
      nombre="Secciones de ajustes"
      compacta
      pestanas={[
        { ruta: "/ajustes", etiqueta: "Perfil", icono: UserRound },
        { ruta: "/ajustes/apariencia", etiqueta: "Apariencia", icono: Palette },
        { ruta: "/ajustes/monedas", etiqueta: "Monedas", icono: Coins },
        { ruta: "/ajustes/seguridad", etiqueta: "Seguridad y datos", icono: ShieldCheck },
      ]}
    />
  );
}
