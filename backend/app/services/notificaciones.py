"""Avisos de la campana: se calculan al vuelo a partir de los datos.

No hay una tabla de avisos que mantener al día: cada vez se mira qué vence
pronto, qué presupuesto se pasa, etc. Cada aviso tiene una clave estable
("suscripcion:5:2026-10-25") y solo se guarda cuáles ya se leyeron.

Base para el correo: un proceso diario podría llamar a `generar()` y enviar a
`correo_recordatorios` los avisos no leídos (el recordatorio incluido).
"""

from datetime import date, datetime, timedelta

from sqlmodel import Session, col, select

from app.models import Cuenta, IngresoRecurrente, NotificacionLeida, Suscripcion, TipoCuenta, Transaccion
from app.schemas import Notificacion
from app.services import configuracion, dashboard, deseos, deudas, metas
from app.services.periodicidad import proxima_fecha_del_dia
from app.services.saldos import a_decimal, movimientos_por_cuenta

DIAS_AVISO = 3  # avisar de lo que vence en los próximos días
HITOS_META = (100, 75, 50, 25)
UMBRALES_PRESUPUESTO = (100, 80)


def _cuando(fecha: date, hoy: date) -> str:
    dias = (fecha - hoy).days
    if dias < 0:
        return f"atrasado {-dias} día{'s' if dias < -1 else ''}"
    return {0: "hoy", 1: "mañana"}.get(dias, f"en {dias} días")


def _vencimientos(session: Session, hoy: date) -> list[Notificacion]:
    """Pagos, cobros, tarjetas y deudas que vencen en DIAS_AVISO días o van atrasados."""
    limite = hoy + timedelta(days=DIAS_AVISO)
    avisos: list[Notificacion] = []

    for s in session.exec(select(Suscripcion).where(Suscripcion.fecha_proximo_pago <= limite)).all():
        avisos.append(Notificacion(
            clave=f"suscripcion:{s.id}:{s.fecha_proximo_pago}", tipo="pago", titulo=f"Pago de {s.nombre}",
            mensaje=f"Vence {_cuando(s.fecha_proximo_pago, hoy)}", fecha=s.fecha_proximo_pago,
            enlace="/pagos-fijos", monto=s.monto, moneda=s.moneda, urgente=s.fecha_proximo_pago <= hoy,
        ))

    for i in session.exec(select(IngresoRecurrente).where(IngresoRecurrente.fecha_proximo_cobro <= limite)).all():
        avisos.append(Notificacion(
            clave=f"cobro:{i.id}:{i.fecha_proximo_cobro}", tipo="cobro", titulo=f"Cobro de {i.nombre}",
            mensaje=f"Llega {_cuando(i.fecha_proximo_cobro, hoy)}: márcalo al recibirlo",
            fecha=i.fecha_proximo_cobro, enlace="/pagos-fijos/ingresos", monto=i.monto, moneda=i.moneda,
        ))

    tarjetas = session.exec(
        select(Cuenta).where(Cuenta.tipo == TipoCuenta.CREDITO, col(Cuenta.dia_pago).is_not(None))
    ).all()
    movimientos = movimientos_por_cuenta(session) if tarjetas else {}
    for t in tarjetas:
        deuda = -a_decimal(t.balance_inicial + movimientos.get(t.id, 0))
        pago = proxima_fecha_del_dia(t.dia_pago, hoy)
        if deuda > 0 and pago <= limite:
            avisos.append(Notificacion(
                clave=f"tarjeta:{t.id}:{pago}", tipo="tarjeta", titulo=f"Pagar la tarjeta {t.nombre}",
                mensaje=f"Fecha límite {_cuando(pago, hoy)}", fecha=pago, enlace="/cuentas",
                monto=deuda, moneda=t.moneda, urgente=pago <= hoy,
            ))

    for d in deudas.listar(session, pendientes=True, hoy=hoy):
        if d.fecha_vencimiento is None or d.fecha_vencimiento > limite:
            continue
        titulo = f"{d.persona} te debe" if d.sentido == "me_deben" else f"Le debes a {d.persona}"
        avisos.append(Notificacion(
            clave=f"deuda:{d.id}:{d.fecha_vencimiento}", tipo="deuda", titulo=titulo,
            mensaje=f"Vence {_cuando(d.fecha_vencimiento, hoy)}", fecha=d.fecha_vencimiento, enlace="/deudas",
            monto=d.pendiente, moneda=d.moneda, urgente=d.vencida,
        ))
    return avisos


def _presupuestos(session: Session, hoy: date) -> list[Notificacion]:
    """El umbral más alto que haya cruzado cada presupuesto del mes en curso."""
    avisos = []
    mes = dashboard.mes_actual(session)
    for p in dashboard.progreso_presupuestos(session, mes, hoy):
        umbral = next((u for u in UMBRALES_PRESUPUESTO if p.porcentaje >= u), None)
        if umbral is None:
            continue
        mensaje = f"Te pasaste: llevas el {p.porcentaje} %" if p.excedido else f"Llevas el {p.porcentaje} %"
        avisos.append(Notificacion(
            clave=f"presupuesto:{p.presupuesto_id}:{mes}:{umbral}", tipo="presupuesto",
            titulo=f"Presupuesto de {p.nombre}", mensaje=mensaje, fecha=hoy, enlace="/presupuestos",
            monto=p.restante, moneda=p.moneda, urgente=p.excedido,
        ))
    return avisos


def _metas(session: Session, hoy: date) -> list[Notificacion]:
    avisos = []
    for m in metas.listar(session, hoy):
        hito = 100 if m.cumplida else next((h for h in HITOS_META if m.porcentaje >= h), None)
        if hito is None:
            continue
        mensaje = "¡Meta cumplida! 🎉" if hito == 100 else f"¡Ya llevas el {hito} %!"
        avisos.append(Notificacion(
            clave=f"meta:{m.id}:{hito}", tipo="meta", titulo=f"{m.icono} {m.nombre}", mensaje=mensaje,
            fecha=m.fecha_cumplida or hoy, enlace="/metas", monto=m.ahorrado, moneda=m.moneda,
        ))
    return avisos


def _deseos(session: Session, ahora: datetime) -> list[Notificacion]:
    return [
        Notificacion(
            clave=f"deseo:{d.id}:{d.reflexion_hasta:%Y-%m-%dT%H:%M}", tipo="deseo",
            titulo=f"¿Aún quieres {d.nombre}?", mensaje="Terminó la espera: lee tu carta y decide",
            fecha=d.reflexion_hasta.date(), enlace="/metas/deseos", monto=d.precio, moneda=d.moneda,
        )
        for d in deseos.listar(session, ahora=ahora)
        if d.listo_para_decidir
    ]


def recordatorio_pendiente(session: Session, ahora: datetime) -> bool:
    """¿Toca recordar que anotes los gastos? Activado, pasada su hora y sin nada anotado hoy."""
    ajustes = configuracion.obtener(session)
    if not ajustes.recordatorio_diario or ahora.hour < ajustes.hora_recordatorio:
        return False
    anotado = session.exec(select(Transaccion.id).where(Transaccion.fecha == ahora.date()).limit(1)).first()
    return anotado is None


def generar(session: Session, ahora: datetime | None = None) -> list[Notificacion]:
    """Todos los avisos de ahora mismo (sin marcar leídos): urgentes primero, luego por fecha."""
    ahora = ahora or datetime.now()
    hoy = ahora.date()
    avisos = [
        *_vencimientos(session, hoy),
        *_presupuestos(session, hoy),
        *_metas(session, hoy),
        *_deseos(session, ahora),
    ]
    if recordatorio_pendiente(session, ahora):
        avisos.append(Notificacion(
            clave=f"recordatorio:{hoy}", tipo="recordatorio", titulo="¿Anotaste tus gastos de hoy?",
            mensaje="Un minuto ahora te ahorra un lío a fin de mes", fecha=hoy, enlace="/transacciones",
        ))
    return sorted(avisos, key=lambda a: (not a.urgente, a.fecha))


def _leidas(session: Session, claves: list[str]) -> set[str]:
    return set(session.exec(select(NotificacionLeida.clave).where(col(NotificacionLeida.clave).in_(claves))).all())


def listar(session: Session, ahora: datetime | None = None) -> list[Notificacion]:
    avisos = generar(session, ahora)
    leidas = _leidas(session, [a.clave for a in avisos])
    return [a.model_copy(update={"leida": a.clave in leidas}) for a in avisos]


def marcar_leidas(session: Session, claves: list[str], ahora: datetime | None = None) -> None:
    ahora = ahora or datetime.now()
    for clave in set(claves) - _leidas(session, claves):
        session.add(NotificacionLeida(clave=clave[:200], leida_en=ahora))
    session.commit()
