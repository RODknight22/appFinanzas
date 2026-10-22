import { SeccionApariencia } from "../components/ajustes/SeccionApariencia";
import { SeccionContrasena } from "../components/ajustes/SeccionContrasena";
import { SeccionCopias } from "../components/ajustes/SeccionCopias";
import { SeccionMonedas } from "../components/ajustes/SeccionMonedas";
import { SeccionPerfil } from "../components/ajustes/SeccionPerfil";
import { SeccionPreferencias } from "../components/ajustes/SeccionPreferencias";
import { SeccionRecordatorios } from "../components/ajustes/SeccionRecordatorios";
import { SeccionTasas } from "../components/ajustes/SeccionTasas";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";

/** Ajustes: cada sección es un componente propio en components/ajustes/. */
export function AjustesPage() {
  return (
    <>
      <EncabezadoPagina titulo="Ajustes" descripcion="Perfil, apariencia, preferencias, recordatorios, monedas, seguridad y copias" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SeccionPerfil />
        <div className="space-y-6">
          <SeccionApariencia />
          <SeccionPreferencias />
          <SeccionRecordatorios />
        </div>
        <SeccionMonedas />
        <SeccionTasas />
        <SeccionContrasena />
        <SeccionCopias />
      </div>
    </>
  );
}
