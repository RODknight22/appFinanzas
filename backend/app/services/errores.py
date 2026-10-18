"""Errores de negocio de la aplicación.

Los servicios lanzan estas excepciones sin saber nada de HTTP; main.py las
traduce a la respuesta HTTP adecuada. Así la lógica queda independiente de la API.
"""


class ErrorDeDominio(Exception):
    """Clase base: cada subclase define su código HTTP."""

    status_code: int = 400

    def __init__(self, mensaje: str) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje


class NoEncontradoError(ErrorDeDominio):
    """El recurso pedido en la URL no existe (404)."""

    status_code = 404


class ReglaDeNegocioError(ErrorDeDominio):
    """Los datos son válidos en forma, pero incumplen una regla (400)."""

    status_code = 400


class ConflictoError(ErrorDeDominio):
    """La operación choca con el estado actual de los datos (409)."""

    status_code = 409


class ServicioExternoError(ErrorDeDominio):
    """Un servicio de internet del que dependemos no respondió (503)."""

    status_code = 503
