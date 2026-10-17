"""Utilidades compartidas por todos los servicios."""

from typing import Any, TypeVar

from sqlmodel import Session, SQLModel, select

from app.services.errores import NoEncontradoError, ReglaDeNegocioError

# TypeVar permite que el tipo devuelto sea el mismo modelo que se pide
# (obtener_o_404(session, Cuenta, 1) devuelve una Cuenta, no un SQLModel genérico).
Modelo = TypeVar("Modelo", bound=SQLModel)


def obtener_o_404(session: Session, modelo: type[Modelo], id_: int, nombre: str) -> Modelo:
    """Busca por id el recurso pedido en la URL; si no existe, lanza un 404."""
    objeto = session.get(modelo, id_)
    if objeto is None:
        raise NoEncontradoError(f"No se encontró {nombre} con id {id_}")
    return objeto


def obtener_referencia(session: Session, modelo: type[Modelo], id_: int, nombre: str) -> Modelo:
    """Busca un recurso referenciado en el cuerpo de la petición.

    Es un 400 y no un 404: la URL sí existe; lo incorrecto son los datos enviados.
    """
    objeto = session.get(modelo, id_)
    if objeto is None:
        raise ReglaDeNegocioError(f"No existe {nombre} con id {id_}")
    return objeto


def existe(session: Session, columna: Any, valor: Any) -> bool:
    """Indica si hay al menos una fila donde `columna == valor`."""
    return session.exec(select(columna).where(columna == valor).limit(1)).first() is not None


def cambios_parciales(cambios: SQLModel, anulables: frozenset[str] = frozenset()) -> dict[str, Any]:
    """Devuelve solo los campos enviados en un PATCH.

    Un `null` explícito solo se acepta en campos opcionales (p. ej. `notas`);
    en uno obligatorio dejaría la fila en un estado inválido.
    """
    datos = cambios.model_dump(exclude_unset=True)
    for campo, valor in datos.items():
        if valor is None and campo not in anulables:
            raise ReglaDeNegocioError(f"El campo '{campo}' no puede ser nulo")
    return datos


def guardar(session: Session, objeto: Modelo) -> Modelo:
    """Guarda en la BD y recarga el objeto (para obtener, p. ej., el id generado)."""
    session.add(objeto)
    session.commit()
    session.refresh(objeto)
    return objeto
