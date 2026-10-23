import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { accesoApi, type Credenciales, type EstadoAcceso } from "../api/acceso";
import { registrarAlPerderSesion } from "../api/cliente";
import { PantallaAcceso } from "../components/acceso/PantallaAcceso";
import { MensajeError } from "../components/ui/Estados";
import { mensajeDeError } from "../utils/errores";
import { vaciarCacheDatos } from "./useDatos";

interface ContextoAcceso {
  usuario: string;
  cerrarSesion: () => Promise<void>;
}

const Contexto = createContext<ContextoAcceso | null>(null);

/**
 * Puerta de entrada de la app. Según el estado del backend muestra:
 * - la pantalla de alta (primera vez, aún no hay usuario),
 * - la de login (hay usuario pero no sesión),
 * - o la app (`children`) cuando hay sesión.
 */
export function AccesoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAcceso | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cargarEstado() {
    setError(null);
    accesoApi
      .estado()
      .then(setEstado)
      .catch((e: unknown) => setError(mensajeDeError(e)));
  }

  useEffect(() => {
    cargarEstado();
    // Si cualquier petición recibe un 401 (sesión caducada), volvemos al login.
    registrarAlPerderSesion(() =>
      setEstado((actual) => actual && { ...actual, autenticado: false, usuario: null }),
    );
  }, []);

  async function entrar(datos: Credenciales) {
    const nuevo = estado?.configurado ? await accesoApi.iniciarSesion(datos) : await accesoApi.registrar(datos);
    setEstado(nuevo);
  }

  async function cerrarSesion() {
    await accesoApi.cerrarSesion();
    vaciarCacheDatos();
    setEstado({ configurado: true, autenticado: false, usuario: null });
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <MensajeError mensaje={`No se pudo conectar con el servidor. ${error}`} onReintentar={cargarEstado} />
      </div>
    );
  }
  if (!estado) return null; // comprobando la sesión (un instante)
  if (!estado.autenticado || !estado.usuario) {
    return <PantallaAcceso primeraVez={!estado.configurado} onEntrar={entrar} />;
  }

  return <Contexto.Provider value={{ usuario: estado.usuario, cerrarSesion }}>{children}</Contexto.Provider>;
}

export function useAcceso(): ContextoAcceso {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useAcceso debe usarse dentro de <AccesoProvider>");
  return contexto;
}
