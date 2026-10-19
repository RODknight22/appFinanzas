interface AvatarProps {
  /** URL de la foto de perfil; si hay, tiene prioridad sobre el emoji. */
  foto?: string | null;
  /** Emoji elegido; si no hay foto ni emoji, se usa la inicial del nombre. */
  avatar: string | null;
  nombre: string;
  tamano?: "sm" | "lg";
}

/** Círculo con la foto, el emoji o la inicial del usuario (en ese orden). */
export function Avatar({ foto, avatar, nombre, tamano = "sm" }: AvatarProps) {
  const caja = tamano === "lg" ? "h-14 w-14 text-2xl" : "h-9 w-9 text-base";
  if (foto) {
    // alt vacío: es decorativa, el nombre ya aparece escrito al lado.
    return <img src={foto} alt="" className={`shrink-0 rounded-full object-cover ${caja}`} />;
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-acento-100 font-semibold text-acento-700 dark:bg-acento-950 dark:text-acento-300 ${caja}`}
      aria-hidden="true"
    >
      {avatar ?? nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}
