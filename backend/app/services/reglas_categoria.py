"""Reglas de categoría para importar extractos: "si el concepto contiene X, es de la categoría Y".

Mandan sobre lo aprendido del historial, que solo acierta con conceptos ya vistos. Se
comparan sin tildes ni mayúsculas, y si encajan varias gana la más concreta (la más larga).
"""

from sqlmodel import Session, col, select

from app.database import normalizar_texto
from app.models import Categoria, ReglaCategoria, TipoMovimiento
from app.schemas import ReglaCategoriaCreate, ReglaCategoriaUpdate
from app.services.comun import cambios_parciales, guardar, obtener_o_404, obtener_referencia
from app.services.errores import ConflictoError


def listar(session: Session) -> list[ReglaCategoria]:
    return list(session.exec(select(ReglaCategoria).order_by(col(ReglaCategoria.texto))).all())


def obtener(session: Session, regla_id: int) -> ReglaCategoria:
    return obtener_o_404(session, ReglaCategoria, regla_id, "la regla")


def _validar(session: Session, regla: ReglaCategoria) -> None:
    """La categoría existe y no hay otra regla con el mismo texto para su tipo (sería ambigua)."""
    categoria = obtener_referencia(session, Categoria, regla.categoria_id, "la categoría")
    clave = normalizar_texto(regla.texto)
    for otra, tipo in session.exec(
        select(ReglaCategoria, Categoria.tipo).join(Categoria, col(ReglaCategoria.categoria_id) == col(Categoria.id))
    ).all():
        if otra.id != regla.id and tipo == categoria.tipo and normalizar_texto(otra.texto) == clave:
            raise ConflictoError(f"Ya hay una regla para «{otra.texto}»")


def crear(session: Session, datos: ReglaCategoriaCreate) -> ReglaCategoria:
    regla = ReglaCategoria.model_validate(datos)
    regla.texto = regla.texto.strip()
    _validar(session, regla)
    return guardar(session, regla)


def actualizar(session: Session, regla_id: int, cambios: ReglaCategoriaUpdate) -> ReglaCategoria:
    regla = obtener(session, regla_id)
    regla.sqlmodel_update(cambios_parciales(cambios))
    regla.texto = regla.texto.strip()
    _validar(session, regla)
    return guardar(session, regla)


def eliminar(session: Session, regla_id: int) -> None:
    session.delete(obtener(session, regla_id))
    session.commit()


class Reglas:
    """Las reglas ya preparadas para comparar muchos conceptos (una consulta por importación)."""

    def __init__(self, session: Session) -> None:
        filas = session.exec(
            select(ReglaCategoria.texto, ReglaCategoria.categoria_id, Categoria.tipo)
            .join(Categoria, col(ReglaCategoria.categoria_id) == col(Categoria.id))
        ).all()
        # La más larga primero: "mercadona online" gana a "mercadona".
        self._reglas = sorted(
            ((normalizar_texto(texto) or "", categoria_id, tipo) for texto, categoria_id, tipo in filas),
            key=lambda regla: len(regla[0]), reverse=True,
        )

    def categoria(self, tipo: TipoMovimiento, concepto: str) -> int | None:
        texto = normalizar_texto(concepto) or ""
        return next((cid for clave, cid, t in self._reglas if t == tipo and clave and clave in texto), None)
