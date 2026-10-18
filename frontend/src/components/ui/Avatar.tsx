interface AvatarProps {
  /** Emoji elegido; si no hay, se usa la inicial del nombre. */
  avatar: string | null;
  nombre: string;
  tamano?: "sm" | "lg";
}

/** Círculo con el emoji del usuario o la inicial de su nombre. */
export function Avatar({ avatar, nombre, tamano = "sm" }: AvatarProps) {
  const caja = tamano === "lg" ? "h-14 w-14 text-2xl" : "h-9 w-9 text-base";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-acento-100 font-semibold text-acento-700 dark:bg-acento-950 dark:text-acento-300 ${caja}`}
      aria-hidden="true"
    >
      {avatar ?? nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}
