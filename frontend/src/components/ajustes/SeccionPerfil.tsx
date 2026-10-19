import { Camera, Trash2 } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";

import { AVATARES } from "../../config";
import { useAcceso } from "../../hooks/useAcceso";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import { prepararFoto } from "../../utils/imagen";
import { Avatar } from "../ui/Avatar";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, Campo, ErrorFormulario } from "../ui/Campo";
import { Tarjeta } from "../ui/Tarjeta";

/** Subir o quitar la foto de perfil. Se guarda al momento, sin pulsar "Guardar perfil". */
function ControlFoto() {
  const { urlFoto, cambiarFoto } = useConfiguracion();
  const { enviando, error, ejecutar } = useEnvio();

  async function alElegirArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = ""; // permite volver a elegir el mismo archivo después
    if (archivo) await ejecutar(async () => cambiarFoto(await prepararFoto(archivo)));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {/* Un <label> que envuelve un input de archivo oculto: así el botón lleva el estilo de la app */}
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-linea-fuerte bg-superficie px-3 py-1.5 text-xs font-medium text-suave hover:bg-realce focus-within:outline-2 focus-within:outline-acento-500 ${
            enviando ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <Camera size={14} />
          {enviando ? "Subiendo…" : urlFoto ? "Cambiar foto" : "Subir foto"}
          <input type="file" accept="image/*" className="sr-only" onChange={alElegirArchivo} disabled={enviando} />
        </label>
        {urlFoto && (
          <Boton variante="fantasma" className="px-2.5 py-1.5 text-xs" onClick={() => ejecutar(() => cambiarFoto(null))} disabled={enviando}>
            <Trash2 size={14} /> Quitar foto
          </Boton>
        )}
      </div>
      <ErrorFormulario mensaje={error} />
    </div>
  );
}

/** Nombre con el que te saluda la app, foto y avatar (emoji o inicial). */
export function SeccionPerfil() {
  const { usuario } = useAcceso();
  const { configuracion, actualizarConfiguracion, urlFoto } = useConfiguracion();
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
      activa ? "bg-acento-100 ring-2 ring-acento-500 dark:bg-acento-950" : "hover:bg-realce"
    }`;

  return (
    <Tarjeta titulo="Perfil">
      <form onSubmit={guardar} className="space-y-4">
        <div className="flex items-center gap-4">
          {/* Vista previa con lo que aún no se ha guardado */}
          <Avatar foto={urlFoto} avatar={avatar} nombre={nombre || usuario} tamano="lg" />
          <div className="min-w-0 flex-1">
            <Campo etiqueta="Tu nombre" ayuda={`Si lo dejas vacío se usa tu usuario (${usuario}).`}>
              <input className={CLASE_ENTRADA} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={50} placeholder={usuario} />
            </Campo>
          </div>
        </div>

        <ControlFoto />

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-suave">
            Avatar {urlFoto && <span className="font-normal text-tenue">(se usa si quitas la foto)</span>}
          </legend>
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
