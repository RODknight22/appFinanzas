import { useState, type FormEvent } from "react";

import { AVATARES } from "../../config";
import { useAcceso } from "../../hooks/useAcceso";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import { Avatar } from "../ui/Avatar";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, Campo, ErrorFormulario } from "../ui/Campo";
import { Tarjeta } from "../ui/Tarjeta";

/** Nombre con el que te saluda la app y avatar (emoji o inicial). */
export function SeccionPerfil() {
  const { usuario } = useAcceso();
  const { configuracion, actualizarConfiguracion } = useConfiguracion();
  const [nombre, setNombre] = useState(configuracion.nombre ?? "");
  const [avatar, setAvatar] = useState<string | null>(configuracion.avatar);
  const { enviando, error, ejecutar } = useEnvio();
  const cambiado = nombre.trim() !== (configuracion.nombre ?? "") || avatar !== configuracion.avatar;

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    await ejecutar(() => actualizarConfiguracion({ nombre: nombre.trim() || null, avatar }));
  }

  const claseOpcion = (activa: boolean) =>
    `flex h-10 w-10 items-center justify-center rounded-full text-xl transition ${
      activa ? "bg-acento-100 ring-2 ring-acento-500 dark:bg-acento-950" : "hover:bg-slate-100 dark:hover:bg-slate-800"
    }`;

  return (
    <Tarjeta titulo="Perfil">
      <form onSubmit={guardar} className="space-y-4">
        <div className="flex items-center gap-4">
          {/* Vista previa con lo que aún no se ha guardado */}
          <Avatar avatar={avatar} nombre={nombre || usuario} tamano="lg" />
          <div className="min-w-0 flex-1">
            <Campo etiqueta="Tu nombre" ayuda={`Si lo dejas vacío se usa tu usuario (${usuario}).`}>
              <input className={CLASE_ENTRADA} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={50} placeholder={usuario} />
            </Campo>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Avatar</legend>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setAvatar(null)} aria-pressed={avatar === null} className={`${claseOpcion(avatar === null)} text-sm font-semibold`} title="Usar la inicial">
              {(nombre || usuario).charAt(0).toUpperCase()}
            </button>
            {AVATARES.map((emoji) => (
              <button key={emoji} type="button" onClick={() => setAvatar(emoji)} aria-pressed={avatar === emoji} aria-label={`Avatar ${emoji}`} className={claseOpcion(avatar === emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        </fieldset>

        <ErrorFormulario mensaje={error} />
        <div className="flex justify-end">
          <Boton type="submit" disabled={!cambiado || enviando}>{enviando ? "Guardando…" : "Guardar perfil"}</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
