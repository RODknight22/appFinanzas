"""Endpoints de acceso: estado, alta del usuario, login, logout y contraseña.

Son los únicos (junto con /health) que funcionan sin sesión.
"""

from fastapi import APIRouter, Response, status

from app.database import SessionDep
from app.dependencias import NOMBRE_COOKIE, TokenCookie, UsuarioActual
from app.schemas import CambioContrasena, DatosLogin, DatosRegistro, EstadoAcceso
from app.services import acceso as servicio

router = APIRouter(prefix="/auth", tags=["Acceso"])


def _poner_cookie(respuesta: Response, token: str) -> None:
    respuesta.set_cookie(
        NOMBRE_COOKIE,
        token,
        max_age=int(servicio.DURACION_SESION.total_seconds()),
        httponly=True,  # JavaScript no puede leerla: protege frente a XSS
        samesite="lax",  # no se envía en peticiones POST desde otras webs (CSRF)
        # secure=True exigiría HTTPS; en una app local servida por http no se puede.
    )


@router.get("/estado", response_model=EstadoAcceso)
def estado(session: SessionDep, token: TokenCookie = None):
    """Dice si ya existe el usuario y si esta petición tiene una sesión válida."""
    return servicio.estado(session, token)


@router.post("/registro", response_model=EstadoAcceso, status_code=status.HTTP_201_CREATED)
def registrar(datos: DatosRegistro, respuesta: Response, session: SessionDep):
    """Crea el único usuario (la primera vez que se usa la app) e inicia sesión."""
    _poner_cookie(respuesta, servicio.registrar(session, datos))
    return EstadoAcceso(configurado=True, autenticado=True, usuario=datos.usuario.strip())


@router.post("/login", response_model=EstadoAcceso)
def iniciar_sesion(datos: DatosLogin, respuesta: Response, session: SessionDep):
    _poner_cookie(respuesta, servicio.iniciar_sesion(session, datos))
    return EstadoAcceso(configurado=True, autenticado=True, usuario=datos.usuario.strip())


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def cerrar_sesion(respuesta: Response, session: SessionDep, token: TokenCookie = None) -> None:
    servicio.cerrar_sesion(session, token)
    # Mismos atributos que al crearla: algunos navegadores no la borran si difieren.
    respuesta.delete_cookie(NOMBRE_COOKIE, httponly=True, samesite="lax")


@router.post("/cambiar-contrasena", status_code=status.HTTP_204_NO_CONTENT)
def cambiar_contrasena(
    datos: CambioContrasena, _usuario: UsuarioActual, session: SessionDep, token: TokenCookie = None
) -> None:
    """Cambia la contraseña y cierra las demás sesiones (otros navegadores)."""
    servicio.cambiar_contrasena(session, token or "", datos)
