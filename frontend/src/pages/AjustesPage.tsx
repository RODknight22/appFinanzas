import { SeccionApariencia } from "../components/ajustes/SeccionApariencia";
import { SeccionContrasena } from "../components/ajustes/SeccionContrasena";
import { SeccionCopias } from "../components/ajustes/SeccionCopias";
import { SeccionMonedas } from "../components/ajustes/SeccionMonedas";
import { SeccionPerfil } from "../components/ajustes/SeccionPerfil";
import { SeccionPreferencias } from "../components/ajustes/SeccionPreferencias";
import { SeccionRecordatorios } from "../components/ajustes/SeccionRecordatorios";
import { SeccionTasas } from "../components/ajustes/SeccionTasas";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";

/*
 * Ajustes en cuatro pestañas (components/Secciones.tsx), una página por pestaña.
 * Cada tarjeta es un componente propio en components/ajustes/.
 */

export function AjustesPerfilPage() {
  return (
    <>
      <EncabezadoPagina titulo="Perfil" descripcion="Tu foto y nombre, cómo se abre la app y los recordatorios" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SeccionPerfil />
        <div className="space-y-6">
          <SeccionPreferencias />
          <SeccionRecordatorios />
        </div>
      </div>
    </>
  );
}

export function AjustesAparienciaPage() {
  return (
    <>
      <EncabezadoPagina titulo="Apariencia" descripcion="Estilo de la app y color de acento" />
      <SeccionApariencia />
    </>
  );
}

export function AjustesMonedasPage() {
  return (
    <>
      <EncabezadoPagina titulo="Monedas" descripcion="Monedas que usas y tasas de cambio" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SeccionMonedas />
        <SeccionTasas />
      </div>
    </>
  );
}

export function AjustesSeguridadPage() {
  return (
    <>
      <EncabezadoPagina titulo="Seguridad y datos" descripcion="Contraseña y copias de seguridad" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SeccionContrasena />
        <SeccionCopias />
      </div>
    </>
  );
}
