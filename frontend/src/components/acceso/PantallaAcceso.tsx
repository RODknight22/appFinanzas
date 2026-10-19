import { LockKeyhole, Wallet } from "lucide-react";
import { useState, type FormEvent } from "react";

import type { Credenciales } from "../../api/acceso";
import { useEnvio } from "../../hooks/useEnvio";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, Campo, ErrorFormulario } from "../ui/Campo";

interface PantallaAccesoProps {
  /** true si aún no existe el usuario: se muestra el alta en lugar del login. */
  primeraVez: boolean;
  onEntrar: (datos: Credenciales) => Promise<void>;
}

const LONGITUD_MINIMA = 8; // la misma que exige el backend

/** Pantalla completa de login (o de creación del usuario la primera vez). */
export function PantallaAcceso({ primeraVez, onEntrar }: PantallaAccesoProps) {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErrorLocal(null);
    if (primeraVez && contrasena !== repetida) {
      setErrorLocal("Las contraseñas no coinciden");
      return;
    }
    await ejecutar(() => onEntrar({ usuario: usuario.trim(), contrasena }));
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm animate-entrada rounded-3xl bg-superficie p-8 shadow-[var(--sombra)] ring-1 ring-linea">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-acento-600 text-white">
            <Wallet size={24} />
          </span>
          <div>
            <h1 className="text-xl font-bold">Mis Finanzas</h1>
            <p className="mt-1 text-sm text-tenue">
              {primeraVez ? "Crea tu usuario y contraseña para proteger tus datos" : "Inicia sesión para continuar"}
            </p>
          </div>
        </div>

        {/* autoComplete ayuda a los gestores de contraseñas del navegador */}
        <form onSubmit={enviar} className="space-y-4">
          <Campo etiqueta="Usuario">
            <input className={CLASE_ENTRADA} value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required maxLength={50} autoFocus />
          </Campo>
          <Campo etiqueta="Contraseña" ayuda={primeraVez ? `Mínimo ${LONGITUD_MINIMA} caracteres` : undefined}>
            <input
              className={CLASE_ENTRADA}
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              autoComplete={primeraVez ? "new-password" : "current-password"}
              minLength={primeraVez ? LONGITUD_MINIMA : undefined}
              required
            />
          </Campo>
          {primeraVez && (
            <Campo etiqueta="Repite la contraseña">
              <input className={CLASE_ENTRADA} type="password" value={repetida} onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" required />
            </Campo>
          )}
          <ErrorFormulario mensaje={errorLocal ?? error} />
          <Boton type="submit" className="w-full" disabled={enviando}>
            <LockKeyhole size={16} />
            {enviando ? "Comprobando…" : primeraVez ? "Crear y entrar" : "Entrar"}
          </Boton>
        </form>

        {primeraVez && (
          <p className="mt-6 text-center text-xs text-tenue">
            Si algún día la olvidas, se puede restablecer desde el servidor sin perder tus datos.
          </p>
        )}
      </div>
    </main>
  );
}
