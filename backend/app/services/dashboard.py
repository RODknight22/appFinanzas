"""Cálculos del dashboard: balances, flujo mensual, gastos por categoría y presupuestos.

Las sumas se hacen en SQL (GROUP BY) para no cargar todas las transacciones en memoria,
siempre sobre `monto_principal`: así se suman importes de distintas monedas.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.models import Categoria, Cuenta, Moneda, Presupuesto, TasaCambio, TipoMovimiento, Transaccion
from app.schemas import (
    FlujoMensual,
    GastoDiario,
    GastoPorCategoria,
    PoderAdquisitivo,
    ProgresoPresupuesto,
    PuntoPatrimonio,
    ResumenMes,
    SaldoCuenta,
)
from app.services import configuracion, divisas, mes_financiero
from app.services.saldos import CENTIMOS, a_decimal, movimientos_por_cuenta, movimientos_por_cuenta_y_mes


# ---------------------------------------------------------------------------
# Utilidades de fechas y dinero
# ---------------------------------------------------------------------------
def mes_actual(session: Session) -> str:
    """El mes financiero en curso (depende del día de inicio de mes elegido)."""
    return mes_financiero.mes_actual(configuracion.dia_inicio_mes(session))


def _rango_mes(session: Session, mes_anio: str) -> tuple[date, date]:
    """[inicio, fin) del mes financiero `mes_anio` según la configuración."""
    return mes_financiero.rango_mes(mes_anio, configuracion.dia_inicio_mes(session))


def _meses_anteriores(hasta_mes: str, cantidad: int) -> list[str]:
    """Lista de `cantidad` meses terminando en `hasta_mes`, del más antiguo al más nuevo."""
    anio, mes = map(int, hasta_mes.split("-"))
    meses: list[str] = []
    for _ in range(cantidad):
        meses.append(f"{anio:04d}-{mes:02d}")
        anio, mes = (anio - 1, 12) if mes == 1 else (anio, mes - 1)
    return list(reversed(meses))


def _porcentaje(parte: Decimal, total: Decimal) -> float:
    return round(float(parte / total * 100), 1) if total else 0.0


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------
def _saldos_por_cuenta(session: Session) -> list[SaldoCuenta]:
    """Saldo de cada cuenta en su moneda y convertido a la principal.

    Para un saldo (dinero que tienes hoy) se usa la tasa de hoy, no la histórica.
    """
    principal = configuracion.moneda_principal(session)
    hoy = date.today()
    cuentas = session.exec(select(Cuenta).order_by(col(Cuenta.nombre))).all()
    movimientos = movimientos_por_cuenta(session)
    if any(cuenta.moneda != principal for cuenta in cuentas):
        divisas.asegurar_tasas_del_dia(session)

    saldos = []
    for cuenta in cuentas:
        moneda = cuenta.moneda or principal
        # .get(): una cuenta sin movimientos no aparece en el diccionario.
        saldo = a_decimal(cuenta.balance_inicial + movimientos.get(cuenta.id, Decimal(0)))
        saldos.append(
            SaldoCuenta(
                cuenta_id=cuenta.id,
                nombre=cuenta.nombre,
                tipo=cuenta.tipo,
                moneda=moneda,
                saldo=saldo,
                saldo_principal=divisas.convertir(session, saldo, moneda, principal, hoy),
                cuenta_padre_id=cuenta.cuenta_padre_id,
                fijada=bool(cuenta.fijada),
            )
        )
    return saldos


def _totales_por_tipo(session: Session, inicio: date, fin: date) -> dict[TipoMovimiento, Decimal]:
    consulta = (
        select(Transaccion.tipo, func.sum(Transaccion.monto_principal))
        .where(Transaccion.fecha >= inicio, Transaccion.fecha < fin)
        .group_by(col(Transaccion.tipo))
    )
    totales = {tipo: Decimal("0.00") for tipo in TipoMovimiento}
    for tipo, suma in session.exec(consulta).all():
        totales[tipo] = a_decimal(suma)
    return totales


def _gastos_por_categoria_id(session: Session, mes_anio: str) -> dict[int, Decimal]:
    inicio, fin = _rango_mes(session, mes_anio)
    consulta = (
        select(Transaccion.categoria_id, func.sum(Transaccion.monto_principal))
        .where(
            Transaccion.tipo == TipoMovimiento.GASTO,
            Transaccion.fecha >= inicio,
            Transaccion.fecha < fin,
        )
        .group_by(col(Transaccion.categoria_id))
    )
    return {categoria_id: a_decimal(suma) for categoria_id, suma in session.exec(consulta).all()}


# ---------------------------------------------------------------------------
# Funciones públicas (una por endpoint)
# ---------------------------------------------------------------------------
def resumen(session: Session, mes_anio: str) -> ResumenMes:
    """Balance global (todas las cuentas, de siempre) y flujo del mes indicado."""
    cuentas = _saldos_por_cuenta(session)
    totales = _totales_por_tipo(session, *_rango_mes(session, mes_anio))
    ingresos, gastos = totales[TipoMovimiento.INGRESO], totales[TipoMovimiento.GASTO]
    return ResumenMes(
        mes_anio=mes_anio,
        balance_global=sum((c.saldo_principal for c in cuentas), Decimal("0.00")),
        ingresos=ingresos,
        gastos=gastos,
        flujo_neto=ingresos - gastos,
        cuentas=cuentas,
    )


def flujo_mensual(session: Session, hasta_mes: str, meses: int) -> list[FlujoMensual]:
    """Ingresos y gastos de los últimos `meses` meses (para el gráfico de barras)."""
    lista_meses = _meses_anteriores(hasta_mes, meses)
    inicio, _ = _rango_mes(session, lista_meses[0])
    _, fin = _rango_mes(session, lista_meses[-1])

    # Agrupamos por mes financiero ("YYYY-MM"), calculado en SQL.
    dia_inicio = configuracion.dia_inicio_mes(session)
    mes_de_fecha = mes_financiero.expresion_mes_sql(col(Transaccion.fecha), dia_inicio)
    consulta = (
        select(mes_de_fecha, Transaccion.tipo, func.sum(Transaccion.monto_principal))
        .where(Transaccion.fecha >= inicio, Transaccion.fecha < fin)
        .group_by(mes_de_fecha, col(Transaccion.tipo))
    )
    sumas = {(mes, tipo): a_decimal(suma) for mes, tipo, suma in session.exec(consulta).all()}

    # Rellenamos con 0 los meses sin movimientos para que el gráfico no tenga huecos.
    resultado: list[FlujoMensual] = []
    for mes in lista_meses:
        ingresos = sumas.get((mes, TipoMovimiento.INGRESO), Decimal("0.00"))
        gastos = sumas.get((mes, TipoMovimiento.GASTO), Decimal("0.00"))
        resultado.append(
            FlujoMensual(mes_anio=mes, ingresos=ingresos, gastos=gastos, flujo_neto=ingresos - gastos)
        )
    return resultado


def gastos_por_categoria(session: Session, mes_anio: str) -> list[GastoPorCategoria]:
    """Reparto de los gastos del mes por categoría (para el gráfico de anillo)."""
    totales = _gastos_por_categoria_id(session, mes_anio)
    if not totales:
        return []
    total_mes = sum(totales.values(), Decimal("0.00"))
    categorias = session.exec(select(Categoria).where(col(Categoria.id).in_(totales))).all()

    resultado = [
        GastoPorCategoria(
            categoria_id=categoria.id,
            nombre=categoria.nombre,
            icono=categoria.icono,
            color=categoria.color,
            total=totales[categoria.id],
            porcentaje=_porcentaje(totales[categoria.id], total_mes),
        )
        for categoria in categorias
    ]
    return sorted(resultado, key=lambda g: g.total, reverse=True)


def _gastos_en_moneda(
    session: Session, mes_anio: str, categoria_ids: set[int], moneda: Moneda
) -> dict[int, Decimal]:
    """Gasto del mes por categoría expresado en `moneda`.

    Lo que se gastó en esa moneda cuenta tal cual (sin pasar por la principal ida y
    vuelta, que movería céntimos); el resto se convierte con la tasa de su fecha.
    """
    inicio, fin = _rango_mes(session, mes_anio)
    consulta = (
        select(Transaccion.categoria_id, Transaccion.moneda, Transaccion.fecha, func.sum(Transaccion.monto))
        .where(
            Transaccion.tipo == TipoMovimiento.GASTO,
            Transaccion.fecha >= inicio,
            Transaccion.fecha < fin,
            col(Transaccion.categoria_id).in_(categoria_ids),
        )
        .group_by(col(Transaccion.categoria_id), col(Transaccion.moneda), col(Transaccion.fecha))
    )
    totales: defaultdict[int, Decimal] = defaultdict(Decimal)
    for categoria_id, moneda_gasto, fecha, suma in session.exec(consulta).all():
        totales[categoria_id] += divisas.convertir_sin_redondeo(session, a_decimal(suma), moneda_gasto, moneda, fecha)
    return {categoria_id: total.quantize(CENTIMOS) for categoria_id, total in totales.items()}


def progreso_presupuestos(session: Session, mes_anio: str, hoy: date | None = None) -> list[ProgresoPresupuesto]:
    """Cuánto se ha gastado de cada presupuesto del mes (para las barras de progreso).

    Cada presupuesto se mide en su moneda; además se dan límite y gasto en la principal
    para los totales. El límite se convierte con la tasa de hoy (o del último día del
    mes, si ya pasó): un límite es una cantidad fija, no un gasto con fecha propia.
    """
    principal = configuracion.moneda_principal(session)
    gastado_principal = _gastos_por_categoria_id(session, mes_anio)
    consulta = (
        select(Presupuesto, Categoria)
        .join(Categoria, col(Categoria.id) == col(Presupuesto.categoria_id))
        .where(Presupuesto.mes_anio == mes_anio)
        .order_by(col(Categoria.nombre))
    )
    filas = session.exec(consulta).all()

    # Una consulta por moneda extranjera con presupuesto, no una por presupuesto.
    por_moneda: dict[Moneda, set[int]] = defaultdict(set)
    for presupuesto, categoria in filas:
        moneda = presupuesto.moneda or principal
        if moneda != principal:
            por_moneda[moneda].add(categoria.id)
    if por_moneda:
        divisas.asegurar_tasas_del_dia(session)
    gastado_en = {moneda: _gastos_en_moneda(session, mes_anio, ids, moneda) for moneda, ids in por_moneda.items()}
    fecha_tasa = min(hoy or date.today(), _rango_mes(session, mes_anio)[1] - timedelta(days=1))

    resultado: list[ProgresoPresupuesto] = []
    for presupuesto, categoria in filas:
        moneda = presupuesto.moneda or principal
        en_principal = gastado_principal.get(categoria.id, Decimal("0.00"))
        gastado = en_principal if moneda == principal else gastado_en[moneda].get(categoria.id, Decimal("0.00"))
        limite = a_decimal(presupuesto.monto_limite)
        resultado.append(
            ProgresoPresupuesto(
                presupuesto_id=presupuesto.id,
                categoria_id=categoria.id,
                nombre=categoria.nombre,
                color=categoria.color,
                mes_anio=mes_anio,
                moneda=moneda,
                monto_limite=limite,
                gastado=gastado,
                restante=limite - gastado,
                porcentaje=_porcentaje(gastado, limite),
                excedido=gastado > limite,
                limite_principal=divisas.convertir(session, limite, moneda, principal, fecha_tasa),
                gastado_principal=en_principal,
            )
        )
    return resultado


def patrimonio(session: Session, hasta_mes: str, meses: int, hoy: date | None = None) -> list[PuntoPatrimonio]:
    """Cuánto dinero tenías en total al cierre de cada mes (el mes en curso, hasta hoy).

    Cada saldo se convierte con la tasa de ese día: así se ve lo que valía
    entonces, también el efecto del tipo de cambio en las cuentas en otra moneda.
    """
    hoy = hoy or date.today()
    principal = configuracion.moneda_principal(session)
    cuentas = session.exec(select(Cuenta)).all()
    if any(cuenta.moneda != principal for cuenta in cuentas):
        divisas.asegurar_tasas_del_dia(session)

    dia_inicio = configuracion.dia_inicio_mes(session)
    lista_meses = _meses_anteriores(hasta_mes, meses)
    manana = hoy + timedelta(days=1)  # nada posterior a hoy cuenta en el patrimonio
    inicio = min(mes_financiero.rango_mes(lista_meses[0], dia_inicio)[0], manana)
    ultimo_corte = min(mes_financiero.rango_mes(lista_meses[-1], dia_inicio)[1], manana)

    # Dos lecturas en vez de tres por mes: lo anterior a la ventana y el desglose por mes dentro.
    acumulado = defaultdict(Decimal, movimientos_por_cuenta(session, antes_de=inicio))
    por_mes = movimientos_por_cuenta_y_mes(session, dia_inicio, inicio, ultimo_corte)

    puntos: list[PuntoPatrimonio] = []
    for mes in lista_meses:
        for cuenta in cuentas:
            acumulado[cuenta.id] += por_mes.get((cuenta.id, mes), Decimal(0))
        _, fin = mes_financiero.rango_mes(mes, dia_inicio)
        corte = min(fin, manana)  # [inicio, corte): el mes en curso solo hasta hoy
        total = sum(
            (
                divisas.convertir(
                    session,
                    cuenta.balance_inicial + acumulado[cuenta.id],
                    cuenta.moneda or principal,
                    principal,
                    corte - timedelta(days=1),
                )
                for cuenta in cuentas
            ),
            Decimal("0.00"),
        )
        puntos.append(PuntoPatrimonio(mes_anio=mes, total=total))
    return puntos


def gastos_diarios(session: Session, mes_anio: str) -> list[GastoDiario]:
    """Total gastado cada día del mes financiero (solo los días con gastos)."""
    inicio, fin = _rango_mes(session, mes_anio)
    consulta = (
        select(Transaccion.fecha, func.sum(Transaccion.monto_principal))
        .where(Transaccion.tipo == TipoMovimiento.GASTO, Transaccion.fecha >= inicio, Transaccion.fecha < fin)
        .group_by(col(Transaccion.fecha))
        .order_by(col(Transaccion.fecha))
    )
    return [GastoDiario(fecha=fecha, total=a_decimal(suma)) for fecha, suma in session.exec(consulta).all()]


# ---------------------------------------------------------------------------
# Poder adquisitivo (cobrar en una moneda y gastar en otra)
# ---------------------------------------------------------------------------
_DIAS_HISTORIAL = 365
# Con menos días de tasas, la "media de 12 meses" no sería una media de verdad.
_MINIMO_DIAS_CON_TASA = 20
_CUATRO_DECIMALES = Decimal("0.0001")


def _moneda_principal_por_tipo(session: Session, desde: date, hasta: date) -> dict[TipoMovimiento, Moneda]:
    """La moneda en la que entra (y sale) más dinero en el periodo, sumado en la principal."""
    principal = configuracion.moneda_principal(session)
    consulta = (
        select(Transaccion.tipo, Transaccion.moneda, Cuenta.moneda, func.sum(Transaccion.monto_principal))
        .join(Cuenta, col(Transaccion.cuenta_id) == col(Cuenta.id))
        .where(Transaccion.fecha >= desde, Transaccion.fecha < hasta)
        .group_by(col(Transaccion.tipo), col(Transaccion.moneda), col(Cuenta.moneda))
    )
    totales: defaultdict[TipoMovimiento, defaultdict[Moneda, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
    for tipo, moneda, moneda_cuenta, suma in session.exec(consulta).all():
        totales[tipo][moneda or moneda_cuenta or principal] += a_decimal(suma)
    return {tipo: max(por_moneda, key=lambda m: por_moneda[m]) for tipo, por_moneda in totales.items()}


def _tasa_media(session: Session, de: Moneda, a: Moneda, desde: date, hasta: date) -> Decimal | None:
    """Media de las tasas diarias (unidades de `de` por 1 de `a`) entre [desde, hasta).

    Solo cuenta los días con tasa de las dos monedas (el USD siempre vale 1).
    None si hay muy pocos días: la media no sería fiable.
    """
    por_dia: defaultdict[date, dict[Moneda, Decimal]] = defaultdict(dict)
    consulta = select(TasaCambio.fecha, TasaCambio.moneda, TasaCambio.por_usd).where(
        col(TasaCambio.moneda).in_([de, a]), TasaCambio.fecha >= desde, TasaCambio.fecha < hasta
    )
    for fecha, moneda, por_usd in session.exec(consulta).all():
        por_dia[fecha][moneda] = por_usd
    tasas = [
        tasas_dia.get(de, Decimal(1)) / tasas_dia.get(a, Decimal(1))
        for tasas_dia in por_dia.values()
        if all(m in tasas_dia or m == Moneda.USD for m in (de, a))
    ]
    return sum(tasas, Decimal(0)) / len(tasas) if len(tasas) >= _MINIMO_DIAS_CON_TASA else None


def poder_adquisitivo(session: Session, mes_anio: str) -> PoderAdquisitivo:
    """Cuánto rinden tus ingresos de una moneda al gastar en otra, este mes frente a 12."""
    inicio, fin = _rango_mes(session, mes_anio)
    hace_un_anio = fin - timedelta(days=_DIAS_HISTORIAL)
    monedas = _moneda_principal_por_tipo(session, hace_un_anio, fin)
    ingreso, gasto = monedas.get(TipoMovimiento.INGRESO), monedas.get(TipoMovimiento.GASTO)
    if ingreso is None or gasto is None or ingreso == gasto:
        return PoderAdquisitivo(mes_anio=mes_anio)

    resultado = PoderAdquisitivo(mes_anio=mes_anio, moneda_ingreso=ingreso, moneda_gasto=gasto)
    media = _tasa_media(session, ingreso, gasto, hace_un_anio, fin)
    if media is None:
        return resultado

    # Los ingresos del mes en esa moneda, cada uno convertido con la tasa de su día.
    consulta = (
        select(Transaccion.monto, Transaccion.fecha)
        .join(Cuenta, col(Transaccion.cuenta_id) == col(Cuenta.id))
        .where(
            Transaccion.tipo == TipoMovimiento.INGRESO,
            Transaccion.fecha >= inicio,
            Transaccion.fecha < fin,
            func.coalesce(Transaccion.moneda, Cuenta.moneda, configuracion.moneda_principal(session)) == ingreso.value,
        )
    )
    ingresos = rindio = Decimal(0)
    for monto, fecha in session.exec(consulta).all():
        ingresos += monto
        rindio += divisas.convertir_sin_redondeo(session, monto, ingreso, gasto, fecha)

    if ingresos:
        tasa_mes = ingresos / rindio
        resultado.ingresos = ingresos.quantize(CENTIMOS)
        resultado.rindio = rindio.quantize(CENTIMOS)
        resultado.diferencia = (rindio - ingresos / media).quantize(CENTIMOS)
    else:
        # Sin ingresos aún este mes: la tasa de hoy (o la del último día del mes, si ya pasó).
        tasa_mes = _tasa_del_mes(session, ingreso, gasto, inicio, fin)
    if tasa_mes is None:
        return resultado
    resultado.tasa_mes = tasa_mes.quantize(_CUATRO_DECIMALES)
    resultado.tasa_media_12_meses = media.quantize(_CUATRO_DECIMALES)
    resultado.rinde_porcentaje = ((media / tasa_mes - 1) * 100).quantize(Decimal("0.1"))
    return resultado


def _tasa_del_mes(session: Session, de: Moneda, a: Moneda, inicio: date, fin: date) -> Decimal | None:
    """La tasa del mes cuando no hay ingresos: la del último día con tasa hasta hoy."""
    dia = min(fin - timedelta(days=1), date.today())
    if dia < inicio:
        return None
    return divisas.convertir_sin_redondeo(session, Decimal(1), a, de, dia)
