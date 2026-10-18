"""Hash de contraseñas y tokens de sesión, solo con la librería estándar.

scrypt es una función de derivación de claves pensada para contraseñas: es
lenta y gasta memoria a propósito, de modo que probar millones de
contraseñas por fuerza bruta resulte inviable.
"""

import hashlib
import hmac
import secrets

# Parámetros recomendados para scrypt (≈16 MB de memoria por cálculo).
_N, _R, _P = 2**14, 8, 1
_LONGITUD = 64


def hash_contrasena(contrasena: str) -> str:
    """Devuelve "scrypt$n$r$p$sal$hash" listo para guardar en la BD."""
    # La sal aleatoria hace que dos contraseñas iguales den hashes distintos.
    sal = secrets.token_bytes(16)
    derivada = hashlib.scrypt(contrasena.encode(), salt=sal, n=_N, r=_R, p=_P, dklen=_LONGITUD)
    return f"scrypt${_N}${_R}${_P}${sal.hex()}${derivada.hex()}"


def verificar_contrasena(contrasena: str, guardado: str) -> bool:
    """Repite el cálculo con la sal guardada y compara los resultados."""
    try:
        _, n, r, p, sal, esperado = guardado.split("$")
    except ValueError:
        return False
    derivada = hashlib.scrypt(
        contrasena.encode(), salt=bytes.fromhex(sal), n=int(n), r=int(r), p=int(p), dklen=_LONGITUD
    )
    # compare_digest tarda lo mismo acierte o falle: no da pistas por tiempo.
    return hmac.compare_digest(derivada.hex(), esperado)


def nuevo_token() -> str:
    """Token aleatorio criptográficamente seguro para la cookie de sesión."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 basta aquí: el token ya es aleatorio y largo (no hace falta scrypt)."""
    return hashlib.sha256(token.encode()).hexdigest()
