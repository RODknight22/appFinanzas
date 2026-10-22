"""Lista de deseos y "máquina del tiempo" para no comprar por impulso.

Un deseo puede entrar en reflexión unos días (24 h, una semana, un mes…) junto
con una carta a tu yo del futuro. Mientras dura no se puede marcar como
comprado; al terminar, lees la carta y decides en frío: comprar, guardarlo en
la lista o descartarlo (y entonces cuenta como dinero que no gastaste).
"""

from datetime import date, datetime, timedelta
from urllib.parse import urlparse

from sqlmodel import Session, col, select

from app.models import Deseo, EstadoDeseo, Meta, PrioridadDeseo
from app.schemas import DecisionDeseo, DeseoCreate, DeseoRead, DeseoUpdate, MetaCreate, MetaRead
from app.services import configuracion, metas
from app.services.comun import cambios_parciales, guardar, obtener_o_404, obtener_referencia
from app.services.errores import ConflictoError

_ANULABLES = frozenset({"enlace", "notas", "meta_id", "carta"})
# Orden de la lista: primero lo que más quieres.
_ORDEN_PRIORIDAD = {PrioridadDeseo.ALTA: 0, PrioridadDeseo.MEDIA: 1, PrioridadDeseo.BAJA: 2}


def _tienda(enlace: str | None) -> str | None:
    """La tienda del enlace, sin "www.": https://www.amazon.es/dp/123 → amazon.es."""
    if not enlace:
        return None
    servidor = urlparse(enlace).hostname or ""
    return servidor.removeprefix("www.") or None


def _a_lectura(deseo: Deseo, ahora: datetime) -> DeseoRead:
    listo = (
        deseo.estado == EstadoDeseo.EN_REFLEXION
        and deseo.reflexion_hasta is not None
        and deseo.reflexion_hasta <= ahora
    )
    return DeseoRead.model_validate(deseo, update={"listo_para_decidir": listo, "tienda": _tienda(deseo.enlace)})


def listar(session: Session, estado: EstadoDeseo | None = None, ahora: datetime | None = None) -> list[DeseoRead]:
    ahora = ahora or datetime.now()
    consulta = select(Deseo).order_by(col(Deseo.creado).desc())
    if estado is not None:
        consulta = consulta.where(Deseo.estado == estado)
    deseos = sorted(session.exec(consulta).all(), key=lambda d: _ORDEN_PRIORIDAD[d.prioridad])
    return [_a_lectura(d, ahora) for d in deseos]


def _obtener(session: Session, deseo_id: int) -> Deseo:
    return obtener_o_404(session, Deseo, deseo_id, "el deseo")


def obtener(session: Session, deseo_id: int, ahora: datetime | None = None) -> DeseoRead:
    return _a_lectura(_obtener(session, deseo_id), ahora or datetime.now())


def _comprobar_meta(session: Session, meta_id: int | None) -> None:
    if meta_id is not None:
        obtener_referencia(session, Meta, meta_id, "la meta")


def crear(session: Session, datos: DeseoCreate, ahora: datetime | None = None) -> DeseoRead:
    ahora = ahora or datetime.now()
    deseo = Deseo.model_validate(datos.model_dump(exclude={"dias_reflexion"}), update={"creado": ahora})
    deseo.moneda = deseo.moneda or configuracion.moneda_principal(session)
    configuracion.comprobar_moneda_activa(session, deseo.moneda)
    _comprobar_meta(session, deseo.meta_id)
    if datos.dias_reflexion:
        deseo.estado = EstadoDeseo.EN_REFLEXION
        deseo.reflexion_hasta = ahora + timedelta(days=datos.dias_reflexion)
    return _a_lectura(guardar(session, deseo), ahora)


def actualizar(session: Session, deseo_id: int, cambios: DeseoUpdate) -> DeseoRead:
    deseo = _obtener(session, deseo_id)
    datos = cambios_parciales(cambios, anulables=_ANULABLES)
    if "moneda" in datos:
        configuracion.comprobar_moneda_activa(session, datos["moneda"])
    _comprobar_meta(session, datos.get("meta_id"))
    deseo.sqlmodel_update(datos)
    return _a_lectura(guardar(session, deseo), datetime.now())


def eliminar(session: Session, deseo_id: int) -> None:
    session.delete(_obtener(session, deseo_id))
    session.commit()


def decidir(session: Session, deseo_id: int, datos: DecisionDeseo, ahora: datetime | None = None) -> DeseoRead:
    """Comprar o guardar exige haber esperado; descartar se puede siempre (¡bien hecho!)."""
    ahora = ahora or datetime.now()
    deseo = _obtener(session, deseo_id)
    if deseo.estado in (EstadoDeseo.COMPRADO, EstadoDeseo.DESCARTADO):
        raise ConflictoError("Este deseo ya está decidido")
    esperando = deseo.estado == EstadoDeseo.EN_REFLEXION and deseo.reflexion_hasta and deseo.reflexion_hasta > ahora
    if esperando and datos.decision != "descartar":
        restante = deseo.reflexion_hasta - ahora
        horas = max(1, round(restante.total_seconds() / 3600))
        plazo = f"{horas} h" if horas < 48 else f"{round(horas / 24)} días"
        raise ConflictoError(f"La máquina del tiempo aún no ha terminado: espera {plazo} más")

    if datos.decision == "guardar":
        deseo.estado, deseo.reflexion_hasta = EstadoDeseo.DESEADO, None
    else:
        deseo.estado = EstadoDeseo.COMPRADO if datos.decision == "comprar" else EstadoDeseo.DESCARTADO
        deseo.fecha_decision = ahora.date()
    return _a_lectura(guardar(session, deseo), ahora)


def reflexionar(session: Session, deseo_id: int, dias: int, ahora: datetime | None = None) -> DeseoRead:
    """Mete (o vuelve a meter) un deseo de la lista en la máquina del tiempo."""
    ahora = ahora or datetime.now()
    deseo = _obtener(session, deseo_id)
    if deseo.estado in (EstadoDeseo.COMPRADO, EstadoDeseo.DESCARTADO):
        raise ConflictoError("Este deseo ya está decidido")
    deseo.estado = EstadoDeseo.EN_REFLEXION
    deseo.reflexion_hasta = ahora + timedelta(days=dias)
    return _a_lectura(guardar(session, deseo), ahora)


def crear_meta(session: Session, deseo_id: int, hoy: date | None = None) -> tuple[DeseoRead, MetaRead]:
    """Convierte el deseo en una meta de ahorro (objetivo = su precio) y los vincula."""
    deseo = _obtener(session, deseo_id)
    if deseo.meta_id is not None:
        raise ConflictoError("Este deseo ya tiene una meta")
    meta = metas.crear(
        session, MetaCreate(nombre=deseo.nombre, icono="🛍️", monto_objetivo=deseo.precio, moneda=deseo.moneda), hoy
    )
    deseo.meta_id = meta.id
    return _a_lectura(guardar(session, deseo), datetime.now()), meta
