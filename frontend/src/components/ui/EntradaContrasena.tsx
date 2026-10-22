import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

import { CLASE_ENTRADA } from "./Campo";

type EntradaContrasenaProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

/** Campo de contraseña con un botón (ojo) para ver lo que se está escribiendo. */
export function EntradaContrasena(props: EntradaContrasenaProps) {
  const [visible, setVisible] = useState(false);
  const Icono = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      {/* pr-10: deja sitio al botón para que el texto no quede debajo */}
      <input {...props} type={visible ? "text" : "password"} className={`${CLASE_ENTRADA} pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-tenue transition-colors hover:text-texto"
      >
        <Icono size={16} />
      </button>
    </div>
  );
}
