"""Login de un único usuario: alta, inicio y cierre de sesión.

La app tiene como mucho un usuario. Las sesiones son tokens aleatorios que
viajan en una cookie; en la BD solo se guarda su hash.
"""

import time
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, delete, select

from app.models import Sesion, Usuario
from app.schemas import CambioContrasena, DatosLogin, DatosRegistro, EstadoAcceso
from app.seguridad import hash_contrasena, hash_token, nuevo_token, verificar_contrasena
from app.services.errores import (
    ConflictoError,
    DemasiadosIntentosError,
    NoAutenticadoError,
    ReglaDeNegocioError,
)

DURACION_SESION = timedelta(days=30)

# Freno a la fuerza bruta: tras _MAX_FALLOS fallos seguidos, un bloqueo que se
# duplica cada vez (1, 2, 4… minutos, hasta 15). En memoria (se reinicia con el
# servidor): suficiente para una app que solo escucha en este ordenador.
_MAX_FALLOS = 5
_BLOQUEO_SEGUNDOS = 60
_BLOQUEO_MAXIMO_SEGUNDOS = 15 * 60
_fallos = 0
_bloqueos = 0
_bloqueado_hasta = 0.0


def _ahora() -> datetime:
    # SQLite no guarda zona horaria: trabajamos siempre en UTC "sin zona".
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _usuario(session: Session) -> Usuario | None:
    return session.exec(select(Usuario)).first()


def _abrir_sesion(session: Session) -> str:
    """Crea una sesión y devuelve el token (en claro solo esta vez, para la cookie)."""
    token = nuevo_token()
    ahora = _ahora()
    # Limpieza de paso: las sesiones caducadas que nadie volvió a usar.
    session.exec(delete(Sesion).where(Sesion.expira < ahora))
    session.add(Sesion(token_hash=hash_token(token), creada=ahora, expira=ahora + DURACION_SESION))
    session.commit()
    return token


def usuario_de_token(session: Session, token: str | None) -> Usuario | None:
    """El usuario si el token corresponde a una sesión vigente; si no, None."""
    if not token:
        return None
    sesion = session.exec(select(Sesion).where(Sesion.token_hash == hash_token(token))).first()
    if sesion is None:
        return None
    if sesion.expira < _ahora():
        session.delete(sesion)
        session.commit()
        return None
    return _usuario(session)


def estado(session: Session, token: str | None) -> EstadoAcceso:
    usuario = usuario_de_token(session, token)
    return EstadoAcceso(
        configurado=_usuario(session) is not None,
        autenticado=usuario is not None,
        usuario=usuario.usuario if usuario else None,
    )


def registrar(session: Session, datos: DatosRegistro) -> str:
    """Crea el único usuario de la app (solo si aún no existe) y abre sesión."""
    if _usuario(session) is not None:
        raise ConflictoError("La app ya tiene un usuario. Inicia sesión.")
    session.add(Usuario(usuario=datos.usuario.strip(), password_hash=hash_contrasena(datos.contrasena)))
    session.commit()
    return _abrir_sesion(session)


def _comprobar_freno() -> None:
    espera = _bloqueado_hasta - time.monotonic()
    if espera > 0:
        raise DemasiadosIntentosError(f"Demasiados intentos. Espera {int(espera) + 1} s y vuelve a probar.")


def _registrar_fallo() -> None:
    global _fallos, _bloqueos, _bloqueado_hasta
    _fallos += 1
    if _fallos >= _MAX_FALLOS:
        duracion = min(_BLOQUEO_SEGUNDOS * 2**_bloqueos, _BLOQUEO_MAXIMO_SEGUNDOS)
        _fallos, _bloqueos, _bloqueado_hasta = 0, _bloqueos + 1, time.monotonic() + duracion


def _registrar_acierto() -> None:
    global _fallos, _bloqueos
    _fallos, _bloqueos = 0, 0


def iniciar_sesion(session: Session, datos: DatosLogin) -> str:
    _comprobar_freno()
    usuario = _usuario(session)
    # Se calcula el hash aunque el nombre de usuario no coincida, para que la
    # respuesta tarde lo mismo y el tiempo no revele qué dato falló.
    contrasena_ok = usuario is not None and verificar_contrasena(datos.contrasena, usuario.password_hash)
    correcto = contrasena_ok and usuario is not None and usuario.usuario == datos.usuario.strip()
    if not correcto:
        _registrar_fallo()
        # Mismo mensaje falle el usuario o la contraseña: no damos pistas.
        raise NoAutenticadoError("Usuario o contraseña incorrectos")

    _registrar_acierto()
    return _abrir_sesion(session)


def cerrar_sesion(session: Session, token: str | None) -> None:
    if token:
        session.exec(delete(Sesion).where(Sesion.token_hash == hash_token(token)))
        session.commit()


def cambiar_contrasena(session: Session, token: str, datos: CambioContrasena) -> None:
    """Cambia la contraseña y cierra todas las demás sesiones abiertas."""
    usuario = usuario_de_token(session, token)
    if usuario is None:
        raise NoAutenticadoError("Inicia sesión para cambiar la contraseña")
    # Mismo freno que el login: con una sesión robada no se podría probar
    # contraseñas sin límite aquí.
    _comprobar_freno()
    if not verificar_contrasena(datos.actual, usuario.password_hash):
        _registrar_fallo()
        raise ReglaDeNegocioError("La contraseña actual no es correcta")
    _registrar_acierto()
    usuario.password_hash = hash_contrasena(datos.nueva)
    session.add(usuario)
    session.exec(delete(Sesion).where(Sesion.token_hash != hash_token(token)))
    session.commit()


def reiniciar_freno_de_intentos() -> None:
    """Solo para tests: deja el contador de fallos a cero."""
    global _fallos, _bloqueos, _bloqueado_hasta
    _fallos, _bloqueos, _bloqueado_hasta = 0, 0, 0.0
