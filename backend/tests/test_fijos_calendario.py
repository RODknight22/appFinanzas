"""Calendario de los fijos: "varias veces al mes", pagos con calendario y fechas de un rango.

El caso de referencia es el de Rodrigo: 5000 MXN de su papá los días 10, 20 y 30.
"""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine, select

from app.migraciones import aplicar_migraciones
from app.models import Periodicidad, Suscripcion
from app.services.periodicidad import Calendario, calendario_de, fechas_en_rango, siguiente_fecha

VARIAS = Periodicidad.VARIAS_AL_MES
PAPA = Calendario(dias_de_cobro=(10, 20, 30))


# --- siguiente_fecha con "varias al mes" -------------------------------------
@pytest.mark.parametrize(
    ("ajustes", "actual", "esperada"),
    [
        (PAPA, date(2026, 11, 10), date(2026, 11, 20)),
        (PAPA, date(2026, 11, 20), date(2026, 11, 30)),
        (PAPA, date(2026, 11, 30), date(2026, 12, 10)),
        (PAPA, date(2026, 11, 1), date(2026, 11, 10)),  # un día suelto se recoloca
        (PAPA, date(2026, 12, 30), date(2027, 1, 10)),  # cambio de año
        # Febrero: el 30 se recorta al 28 (o 29) y de ahí se pasa al 10 de marzo.
        (PAPA, date(2027, 2, 20), date(2027, 2, 28)),
        (PAPA, date(2027, 2, 28), date(2027, 3, 10)),
        (PAPA, date(2028, 2, 20), date(2028, 2, 29)),
        (Calendario(dias_de_cobro=(5, 15, 30)), date(2027, 2, 15), date(2027, 2, 28)),
        # 30 y 31 caen el mismo día en febrero: un solo cobro, no dos.
        (Calendario(dias_de_cobro=(30, 31)), date(2027, 2, 1), date(2027, 2, 28)),
        (Calendario(dias_de_cobro=(30, 31)), date(2027, 2, 28), date(2027, 3, 30)),
        (Calendario(dias_de_cobro=(30, 31)), date(2027, 3, 30), date(2027, 3, 31)),
        # Un solo día al mes funciona como una mensual.
        (Calendario(dias_de_cobro=(31,)), date(2027, 1, 31), date(2027, 2, 28)),
        (Calendario(dias_de_cobro=(31,)), date(2027, 2, 28), date(2027, 3, 31)),
        # Sin días (no debería pasar: la API lo impide), el día de la fecha cada mes.
        (Calendario(), date(2026, 11, 7), date(2026, 12, 7)),
    ],
)
def test_varias_al_mes(ajustes: Calendario, actual: date, esperada: date) -> None:
    assert siguiente_fecha(actual, VARIAS, ajustes) == esperada


def test_varias_al_mes_adelanta_al_viernes_sin_repetir() -> None:
    # Octubre de 2026: el 10 es sábado (→ viernes 9); el 20 martes; el 30 viernes.
    ajustes = Calendario(dias_de_cobro=(10, 20, 30), adelantar_a_habil=True)
    fechas = [date(2026, 10, 1)]
    for _ in range(4):
        fechas.append(siguiente_fecha(fechas[-1], VARIAS, ajustes))
    assert fechas[1:] == [date(2026, 10, 9), date(2026, 10, 20), date(2026, 10, 30), date(2026, 11, 10)]


def test_dos_dias_de_fin_de_semana_caen_en_un_solo_viernes() -> None:
    # Sábado 10 y domingo 11 de octubre de 2026 → los dos al viernes 9: una fecha pendiente.
    ajustes = Calendario(dias_de_cobro=(10, 11), adelantar_a_habil=True)
    assert siguiente_fecha(date(2026, 10, 1), VARIAS, ajustes) == date(2026, 10, 9)
    assert siguiente_fecha(date(2026, 10, 9), VARIAS, ajustes) == date(2026, 11, 10)


def test_la_quincenal_sigue_igual() -> None:
    # Mismos resultados que antes de generalizar a N días.
    assert siguiente_fecha(date(2026, 10, 15), Periodicidad.QUINCENAL) == date(2026, 10, 31)
    assert siguiente_fecha(date(2027, 2, 15), Periodicidad.QUINCENAL) == date(2027, 2, 28)
    ajustes = Calendario(dias_quincena=(1, 16))
    assert siguiente_fecha(date(2026, 10, 16), Periodicidad.QUINCENAL, ajustes) == date(2026, 11, 1)


# --- fechas_en_rango ---------------------------------------------------------
NOVIEMBRE = (date(2026, 11, 1), date(2026, 11, 30))


def test_fechas_en_rango_del_papa() -> None:
    assert fechas_en_rango(date(2026, 11, 10), VARIAS, PAPA, *NOVIEMBRE) == [
        date(2026, 11, 10), date(2026, 11, 20), date(2026, 11, 30),
    ]


def test_fechas_en_rango_sin_las_ya_cobradas() -> None:
    # Ya cobró el 10: la próxima pendiente es el 20.
    assert fechas_en_rango(date(2026, 11, 20), VARIAS, PAPA, *NOVIEMBRE) == [date(2026, 11, 20), date(2026, 11, 30)]


def test_fechas_en_rango_con_un_cobro_atrasado() -> None:
    # El del 30 de octubre sigue pendiente, pero cae fuera del rango: solo los de noviembre.
    assert fechas_en_rango(date(2026, 10, 30), VARIAS, PAPA, *NOVIEMBRE) == [
        date(2026, 11, 10), date(2026, 11, 20), date(2026, 11, 30),
    ]


@pytest.mark.parametrize(
    ("fecha_proxima", "periodicidad", "ajustes", "esperadas"),
    [
        (date(2026, 11, 5), Periodicidad.MENSUAL, Calendario(), [date(2026, 11, 5)]),
        (date(2026, 11, 15), Periodicidad.QUINCENAL, Calendario(), [date(2026, 11, 15), date(2026, 11, 30)]),
        (date(2026, 11, 2), Periodicidad.SEMANAL, Calendario(intervalo=2), [date(2026, 11, 2), date(2026, 11, 16), date(2026, 11, 30)]),
        (date(2026, 12, 1), Periodicidad.MENSUAL, Calendario(), []),  # aún no toca
        (date(2027, 3, 1), Periodicidad.ANUAL, Calendario(), []),
        # Con viernes adelantado: el 1 de noviembre (domingo) se paga el viernes 30 de octubre.
        (date(2026, 10, 30), Periodicidad.MENSUAL, Calendario(dia_del_mes=1, adelantar_a_habil=True), []),
    ],
)
def test_fechas_en_rango_otras_periodicidades(
    fecha_proxima: date, periodicidad: Periodicidad, ajustes: Calendario, esperadas: list[date]
) -> None:
    assert fechas_en_rango(fecha_proxima, periodicidad, ajustes, *NOVIEMBRE) == esperadas


def test_fechas_en_rango_vacio_si_hasta_es_anterior() -> None:
    assert fechas_en_rango(date(2026, 11, 10), VARIAS, PAPA, date(2026, 11, 30), date(2026, 11, 1)) == []


def test_calendario_de_una_fila_antigua_es_el_clasico() -> None:
    fila = Suscripcion(nombre="Netflix", monto=Decimal("10"), periodicidad=Periodicidad.MENSUAL, fecha_proximo_pago=date(2026, 11, 5))
    assert calendario_de(fila) == Calendario()


# --- Ingresos por la API -----------------------------------------------------
def _ingreso_papa(client: TestClient, cuenta: dict, categoria: dict, **extra) -> dict:
    datos = {
        "nombre": "Papá", "monto": "5000", "periodicidad": "varias_al_mes", "fecha_proximo_cobro": "2026-11-10",
        "dias_de_cobro": [30, 10, 20, 20], "cuenta_id": cuenta["id"], "categoria_id": categoria["id"], **extra,
    }
    return client.post("/ingresos-recurrentes", json=datos)


def test_ingreso_varias_al_mes_ordena_los_dias_y_cobra_en_cada_uno(
    client: TestClient, cuenta: dict, categoria_ingreso: dict
) -> None:
    respuesta = _ingreso_papa(client, cuenta, categoria_ingreso)
    assert respuesta.status_code == 201
    ingreso = respuesta.json()
    assert ingreso["dias_de_cobro"] == [10, 20, 30]  # ordenados y sin repetir

    proximas = []
    for _ in range(3):
        cobro = client.post(f"/ingresos-recurrentes/{ingreso['id']}/registrar-cobro", json={}).json()
        proximas.append(cobro["ingreso"]["fecha_proximo_cobro"])
    assert proximas == ["2026-11-20", "2026-11-30", "2026-12-10"]


@pytest.mark.parametrize(
    ("extra", "codigo"),
    [
        ({"dias_de_cobro": None}, 400),  # "varias al mes" sin días
        ({"dias_de_cobro": []}, 422),
        ({"dias_de_cobro": [0, 10]}, 422),
        ({"dias_de_cobro": [10, 32]}, 422),
        ({"dias_de_cobro": list(range(1, 12))}, 422),  # más de 10
    ],
)
def test_dias_de_cobro_invalidos(
    client: TestClient, cuenta: dict, categoria_ingreso: dict, extra: dict, codigo: int
) -> None:
    assert _ingreso_papa(client, cuenta, categoria_ingreso, **extra).status_code == codigo


def test_patch_no_deja_varias_al_mes_sin_dias(client: TestClient, cuenta: dict, categoria_ingreso: dict) -> None:
    ingreso = _ingreso_papa(client, cuenta, categoria_ingreso).json()
    url = f"/ingresos-recurrentes/{ingreso['id']}"
    assert client.patch(url, json={"dias_de_cobro": None}).status_code == 400
    # Pasar a mensual y quitar los días a la vez sí vale.
    cambio = client.patch(url, json={"periodicidad": "mensual", "dias_de_cobro": None})
    assert cambio.status_code == 200
    assert cambio.json()["dias_de_cobro"] is None


# --- Suscripciones (pagos fijos) con calendario ------------------------------
def _suscripcion(client: TestClient, **extra) -> dict:
    datos = {"nombre": "Clases", "monto": "40", "periodicidad": "mensual", "fecha_proximo_pago": "2026-11-05", **extra}
    return client.post("/suscripciones", json=datos)


def test_suscripcion_con_calendario_y_pago_de_un_clic(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    respuesta = _suscripcion(
        client, periodicidad="varias_al_mes", dias_de_cobro=[5, 15, 30], adelantar_a_habil=True,
        cuenta_id=cuenta["id"], categoria_id=categoria_gasto["id"],
    )
    assert respuesta.status_code == 201
    suscripcion = respuesta.json()
    assert suscripcion["dias_de_cobro"] == [5, 15, 30]

    # Sin cuenta ni categoría en el cuerpo: usa las de la suscripción.
    url = f"/suscripciones/{suscripcion['id']}/registrar-pago"
    pago = client.post(url, json={"fecha_prevista": "2026-11-05"})
    assert pago.status_code == 201
    cuerpo = pago.json()
    assert cuerpo["transaccion"]["cuenta_id"] == cuenta["id"]
    assert cuerpo["transaccion"]["categoria_id"] == categoria_gasto["id"]
    # 5 → 15 (domingo 15 de noviembre de 2026 → viernes 13) → 30 (lunes).
    assert cuerpo["suscripcion"]["fecha_proximo_pago"] == "2026-11-13"
    assert client.post(url, json={}).json()["suscripcion"]["fecha_proximo_pago"] == "2026-11-30"
    # Repetir el pago del 13 (doble clic) no avanza otra vez.
    assert client.post(url, json={"fecha_prevista": "2026-11-13"}).status_code == 409


def test_registrar_pago_usa_el_dia_del_mes_de_la_suscripcion(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    # Antes registrar_pago ignoraba el calendario: el 28 de febrero pasaba al 28 de marzo.
    suscripcion = _suscripcion(client, fecha_proximo_pago="2027-02-28", dia_del_mes=31).json()
    pago = client.post(
        f"/suscripciones/{suscripcion['id']}/registrar-pago",
        json={"cuenta_id": cuenta["id"], "categoria_id": categoria_gasto["id"]},
    ).json()
    assert pago["suscripcion"]["fecha_proximo_pago"] == "2027-03-31"


def test_lo_elegido_al_pagar_manda_sobre_lo_guardado(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    otra = client.post("/cuentas", json={"nombre": "Efectivo", "tipo": "efectivo"}).json()
    suscripcion = _suscripcion(client, cuenta_id=cuenta["id"], categoria_id=categoria_gasto["id"]).json()
    pago = client.post(f"/suscripciones/{suscripcion['id']}/registrar-pago", json={"cuenta_id": otra["id"]}).json()
    assert pago["transaccion"]["cuenta_id"] == otra["id"]


def test_pago_sin_cuenta_guardada_ni_enviada(client: TestClient) -> None:
    suscripcion = _suscripcion(client).json()
    respuesta = client.post(f"/suscripciones/{suscripcion['id']}/registrar-pago", json={})
    assert respuesta.status_code == 400
    assert client.get(f"/suscripciones/{suscripcion['id']}").json()["fecha_proximo_pago"] == "2026-11-05"


def test_cuenta_y_categoria_por_defecto_van_juntas_y_de_gasto(
    client: TestClient, cuenta: dict, categoria_gasto: dict, categoria_ingreso: dict
) -> None:
    assert _suscripcion(client, cuenta_id=cuenta["id"]).status_code == 400
    assert _suscripcion(client, cuenta_id=cuenta["id"], categoria_id=categoria_ingreso["id"]).status_code == 400
    assert _suscripcion(client, cuenta_id=999, categoria_id=categoria_gasto["id"]).status_code in (400, 404)
    suscripcion = _suscripcion(client, cuenta_id=cuenta["id"], categoria_id=categoria_gasto["id"]).json()
    # Quitarlas con null (las dos) vale; solo una, no.
    url = f"/suscripciones/{suscripcion['id']}"
    assert client.patch(url, json={"categoria_id": None}).status_code == 400
    quitadas = client.patch(url, json={"cuenta_id": None, "categoria_id": None})
    assert quitadas.status_code == 200
    assert quitadas.json()["cuenta_id"] is None


def test_borrar_la_cuenta_por_defecto_no_se_bloquea(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    suscripcion = _suscripcion(client, cuenta_id=cuenta["id"], categoria_id=categoria_gasto["id"]).json()
    assert client.delete(f"/cuentas/{cuenta['id']}").status_code == 204
    actual = client.get(f"/suscripciones/{suscripcion['id']}").json()
    assert actual["cuenta_id"] is None and actual["categoria_id"] is None
    # Y la categoría (ya libre) también se puede borrar.
    assert client.delete(f"/categorias/{categoria_gasto['id']}").status_code == 204


def test_suscripcion_antigua_sin_calendario_sigue_igual(
    client: TestClient, cuenta: dict, categoria_gasto: dict
) -> None:
    suscripcion = _suscripcion(client, fecha_proximo_pago="2026-01-31").json()
    assert suscripcion["dias_de_cobro"] is None and suscripcion["cuenta_id"] is None
    pago = client.post(
        f"/suscripciones/{suscripcion['id']}/registrar-pago",
        json={"cuenta_id": cuenta["id"], "categoria_id": categoria_gasto["id"]},
    ).json()
    assert pago["suscripcion"]["fecha_proximo_pago"] == "2026-02-28"


# --- Compatibilidad con una BD de la versión anterior ------------------------
def test_bd_antigua_migra_y_admite_varias_al_mes() -> None:
    """Tablas como las creaba la versión anterior (enum en VARCHAR(9), sin columnas nuevas)."""
    engine = create_engine("sqlite://")
    with engine.begin() as conexion:
        conexion.execute(text(
            "CREATE TABLE suscripcion (nombre VARCHAR(100) NOT NULL, monto NUMERIC(12, 2) NOT NULL, "
            "periodicidad VARCHAR(9) NOT NULL, fecha_proximo_pago DATE NOT NULL, moneda VARCHAR(3), "
            "id INTEGER NOT NULL, PRIMARY KEY (id))"
        ))
        conexion.execute(text("INSERT INTO suscripcion VALUES ('Netflix', 15.99, 'MENSUAL', '2026-11-05', 'EUR', 1)"))
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conexion:
        aplicar_migraciones(conexion)

    with Session(engine) as session:
        antigua = session.get(Suscripcion, 1)
        assert antigua is not None
        assert antigua.periodicidad == Periodicidad.MENSUAL
        assert antigua.dias_de_cobro is None and antigua.cuenta_id is None
        assert calendario_de(antigua) == Calendario()
        # Un valor del enum más largo que el VARCHAR(9) original: SQLite no lo limita.
        session.add(Suscripcion(
            nombre="Clases", monto=Decimal("40"), periodicidad=VARIAS, fecha_proximo_pago=date(2026, 11, 5), dias_de_cobro=[5, 15, 30],
        ))
        session.commit()

    with Session(engine) as session:
        nueva = session.exec(select(Suscripcion).where(Suscripcion.nombre == "Clases")).one()
        assert nueva.periodicidad == VARIAS and nueva.dias_de_cobro == [5, 15, 30]
        assert calendario_de(nueva).dias_de_cobro == (5, 15, 30)
