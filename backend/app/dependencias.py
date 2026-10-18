"""Dependencias de FastAPI relacionadas con la sesión del usuario."""

from typing import Annotated

from fastapi import Cookie, Depends

from app.database import SessionDep
from app.models import Usuario
from app.services import acceso
from app.services.errores import NoAutenticadoError

NOMBRE_COOKIE = "sesion"

# Lee la cookie "sesion" de la petición (None si no viene).
TokenCookie = Annotated[str | None, Cookie(alias=NOMBRE_COOKIE)]


def requiere_sesion(session: SessionDep, token: TokenCookie = None) -> Usuario:
    """Se añade a los routers protegidos: sin sesión válida, responde 401."""
    usuario = acceso.usuario_de_token(session, token)
    if usuario is None:
        raise NoAutenticadoError("Tu sesión no es válida o ha caducado. Inicia sesión.")
    return usuario


UsuarioActual = Annotated[Usuario, Depends(requiere_sesion)]
