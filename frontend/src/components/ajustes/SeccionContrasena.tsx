import { useState, type FormEvent } from "react";

import { accesoApi } from "../../api/acceso";
import { useEnvio } from "../../hooks/useEnvio";
import { Boton } from "../ui/Boton";
import { Campo, ErrorFormulario } from "../ui/Campo";
import { EntradaContrasena } from "../ui/EntradaContrasena";
import { Tarjeta } from "../ui/Tarjeta";

/** Cambiar la contraseña. Cierra la sesión en los demás navegadores. */
export function SeccionContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setAviso(null);
    setErrorLocal(null);
    if (nueva !== repetida) {
      setErrorLocal("Las contraseñas nuevas no coinciden");
      return;
    }
    if (await ejecutar(() => accesoApi.cambiarContrasena(actual, nueva))) {
      setActual("");
      setNueva("");
      setRepetida("");
      setAviso("Contraseña cambiada. Se cerró la sesión en los demás navegadores.");
    }
  }

  return (
    <Tarjeta titulo="Contraseña">
      <form onSubmit={enviar} className="space-y-3">
        <Campo etiqueta="Contraseña actual">
          <EntradaContrasena value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nueva contraseña" ayuda="Mínimo 8 caracteres">
            <EntradaContrasena value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" minLength={8} required />
          </Campo>
          <Campo etiqueta="Repite la nueva">
            <EntradaContrasena value={repetida} onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" required />
          </Campo>
        </div>
        <ErrorFormulario mensaje={errorLocal ?? error} />
        {aviso && <p className="text-sm text-exito">{aviso}</p>}
        <div className="flex justify-end">
          <Boton type="submit" disabled={enviando}>{enviando ? "Guardando…" : "Cambiar contraseña"}</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
