"""Propiedades financieras: reglas que deben cumplirse siempre, con cualquier historial.

En vez de comprobar un caso concreto, se hacen muchas operaciones aleatorias
(crear, editar y borrar gastos, ingresos y transferencias, en MXN y EUR) y, en
paralelo, un modelo de referencia en Python puro calcula lo que *debería* haber.
La semilla es fija: cada ejecución repite exactamente la misma secuencia, y si un
test falla el mensaje dice en qué paso.

Tasas de ejemplo (conftest.py): 1 EUR = 20 MXN exactos, así los importes
convertidos no necesitan redondeo y el modelo no tiene que imitarlo.
"""

import random
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Moneda, TipoMovimiento, Transaccion
from app.services import dashboard, saldos

MXN_POR_EUR = Decimal(20)
MESES_VENTANA = 8
DIAS_ATRAS = 200  # todas las fechas caben en los MESES_VENTANA meses que se revisan


def _a_mxn(importe: Decimal, moneda: str) -> Decimal:
    return importe * MXN_POR_EUR if moneda == "EUR" else importe


def _mes(fecha: date) -> str:
    return fecha.strftime("%Y-%m")  # día de inicio de mes por defecto: el 1


def _meses_hasta_hoy(cantidad: int) -> list[str]:
    hoy = date.today()
    anio, mes = hoy.year, hoy.month
    meses = []
    for _ in range(cantidad):
        meses.append(f"{anio:04d}-{mes:02d}")
        anio, mes = (anio, mes - 1) if mes > 1 else (anio - 1, 12)
    return meses[::-1]


def _fin_de_mes(mes_anio: str) -> date:
    """Primer día del mes siguiente (el corte es exclusivo, como en la app)."""
    anio, mes = map(int, mes_anio.split("-"))
    return date(anio + mes // 12, mes % 12 + 1, 1)


# ---------------------------------------------------------------------------
# Modelo de referencia
# ---------------------------------------------------------------------------
@dataclass
class Movimiento:
    """Un cambio en el saldo de una cuenta, tal como lo calcularía una persona a mano."""

    cuenta_id: int
    fecha: date
    delta: Decimal  # en la moneda de la cuenta, con signo
    tipo: str | None = None  # "ingreso"/"gasto"; None si no cuenta en el flujo (transferencia)
    en_mxn: Decimal = Decimal(0)  # importe en la moneda principal, para ingresos y gastos


@dataclass
class Modelo:
    iniciales: dict[int, Decimal]
    monedas: dict[int, str]
    # Clave "t<id>" (transacción) o "tr<id>" (transferencia y su comisión).
    operaciones: dict[str, list[Movimiento]] = field(default_factory=dict)

    def _movimientos(self) -> list[Movimiento]:
        return [m for lista in self.operaciones.values() for m in lista]

    def saldo(self, cuenta_id: int, antes_de: date | None = None) -> Decimal:
        deltas = (
            m.delta for m in self._movimientos()
            if m.cuenta_id == cuenta_id and (antes_de is None or m.fecha < antes_de)
        )
        return self.iniciales[cuenta_id] + sum(deltas, Decimal(0))

    def patrimonio(self, antes_de: date | None = None) -> Decimal:
        return sum((_a_mxn(self.saldo(c, antes_de), self.monedas[c]) for c in self.iniciales), Decimal(0))

    def total(self, tipo: str, mes_anio: str) -> Decimal:
        importes = (m.en_mxn for m in self._movimientos() if m.tipo == tipo and _mes(m.fecha) == mes_anio)
        return sum(importes, Decimal(0))


# ---------------------------------------------------------------------------
# Generador de operaciones aleatorias
# ---------------------------------------------------------------------------
class Escenario:
    """Hace operaciones aleatorias contra la API y las anota en el modelo."""

    def __init__(self, client: TestClient, semilla: int, cuentas: list[dict], categorias: dict[str, dict]):
        self.client = client
        self.azar = random.Random(semilla)
        self.cuentas = cuentas
        self.categorias = categorias
        self.modelo = Modelo(
            iniciales={c["id"]: Decimal(c["balance_inicial"]) for c in cuentas},
            monedas={c["id"]: c["moneda"] for c in cuentas},
        )
        self.transacciones: dict[int, dict] = {}  # id → datos enviados (para editar)
        self.transferencias: dict[int, dict] = {}

    # --- valores aleatorios --------------------------------------------------
    def _importe(self) -> Decimal:
        # Mezcla céntimos sueltos con importes grandes: lo que más castiga al redondeo.
        return Decimal(self.azar.choice([1, 7, 10, 33, 99, 1999, 50000, self.azar.randint(1, 200000)])) / 100

    def _fecha(self) -> date:
        return date.today() - timedelta(days=self.azar.randint(0, DIAS_ATRAS))

    # --- transacciones -------------------------------------------------------
    def _anotar_transaccion(self, id_: int, datos: dict) -> None:
        cuenta_id, monto, moneda = datos["cuenta_id"], Decimal(datos["monto"]), datos["moneda"]
        # Un gasto en EUR desde una cuenta en MXN descuenta su equivalente en pesos.
        en_cuenta = monto * MXN_POR_EUR if moneda == "EUR" and self.modelo.monedas[cuenta_id] == "MXN" else monto
        signo = 1 if datos["tipo"] == "ingreso" else -1
        self.modelo.operaciones[f"t{id_}"] = [
            Movimiento(cuenta_id, date.fromisoformat(datos["fecha"]), signo * en_cuenta,
                       datos["tipo"], _a_mxn(monto, moneda))
        ]

    def crear_transaccion(self) -> None:
        cuenta = self.azar.choice(self.cuentas)
        # Cuentas en MXN pueden gastar en EUR; al revés no (1/20 obligaría a redondear).
        moneda = self.azar.choice(["MXN", "EUR"]) if cuenta["moneda"] == "MXN" else "EUR"
        tipo = self.azar.choice(["gasto", "gasto", "ingreso"])
        datos = {"monto": str(self._importe()), "moneda": moneda, "tipo": tipo, "fecha": self._fecha().isoformat(),
                 "cuenta_id": cuenta["id"], "categoria_id": self.categorias[tipo]["id"]}
        respuesta = self.client.post("/transacciones", json=datos)
        assert respuesta.status_code == 201, respuesta.text
        id_ = respuesta.json()["id"]
        self.transacciones[id_] = datos
        self._anotar_transaccion(id_, datos)

    def editar_transaccion(self) -> None:
        if not self.transacciones:
            return self.crear_transaccion()
        id_ = self.azar.choice(list(self.transacciones))
        cambios = {"monto": str(self._importe()), "fecha": self._fecha().isoformat()}
        respuesta = self.client.patch(f"/transacciones/{id_}", json=cambios)
        assert respuesta.status_code == 200, respuesta.text
        self.transacciones[id_] |= cambios
        self._anotar_transaccion(id_, self.transacciones[id_])

    def borrar_transaccion(self) -> None:
        if not self.transacciones:
            return self.crear_transaccion()
        id_ = self.azar.choice(list(self.transacciones))
        assert self.client.delete(f"/transacciones/{id_}").status_code == 204
        del self.transacciones[id_]
        del self.modelo.operaciones[f"t{id_}"]

    # --- transferencias ------------------------------------------------------
    def _importes_transferencia(self, origen: int, destino: int) -> dict:
        datos: dict = {"monto_origen": str(self._importe())}
        if self.modelo.monedas[origen] != self.modelo.monedas[destino]:
            datos["monto_destino"] = str(self._importe())  # lo que dio el banco, no la estimación
        return datos

    def _anotar_transferencia(self, id_: int, datos: dict) -> None:
        origen, destino = datos["cuenta_origen_id"], datos["cuenta_destino_id"]
        fecha = date.fromisoformat(datos["fecha"])
        sale = Decimal(datos["monto_origen"])
        llega = Decimal(datos.get("monto_destino") or sale)
        movimientos = [Movimiento(origen, fecha, -sale), Movimiento(destino, fecha, llega)]
        if datos.get("comision"):
            comision = Decimal(datos["comision"])
            movimientos.append(
                Movimiento(origen, fecha, -comision, "gasto", _a_mxn(comision, self.modelo.monedas[origen]))
            )
        self.modelo.operaciones[f"tr{id_}"] = movimientos

    def crear_transferencia(self) -> None:
        origen, destino = self.azar.sample([c["id"] for c in self.cuentas], 2)
        datos = {"cuenta_origen_id": origen, "cuenta_destino_id": destino, "fecha": self._fecha().isoformat(),
                 **self._importes_transferencia(origen, destino)}
        if self.azar.random() < 0.5:
            datos["comision"] = str(self._importe())
        respuesta = self.client.post("/transferencias", json=datos)
        assert respuesta.status_code == 201, respuesta.text
        id_ = respuesta.json()["id"]
        self.transferencias[id_] = datos
        self._anotar_transferencia(id_, datos)

    def editar_transferencia(self) -> None:
        if not self.transferencias:
            return self.crear_transferencia()
        id_ = self.azar.choice(list(self.transferencias))
        datos = self.transferencias[id_]
        cambios = self._importes_transferencia(datos["cuenta_origen_id"], datos["cuenta_destino_id"])
        cambios["fecha"] = self._fecha().isoformat()
        # La comisión puede cambiar, quitarse (null) o quedarse como estaba.
        eleccion = self.azar.choice(["igual", "nueva", "quitar"])
        if eleccion != "igual":
            cambios["comision"] = str(self._importe()) if eleccion == "nueva" else None
        respuesta = self.client.patch(f"/transferencias/{id_}", json=cambios)
        assert respuesta.status_code == 200, respuesta.text
        datos |= cambios
        self._anotar_transferencia(id_, datos)

    def borrar_transferencia(self) -> None:
        if not self.transferencias:
            return self.crear_transferencia()
        id_ = self.azar.choice(list(self.transferencias))
        assert self.client.delete(f"/transferencias/{id_}").status_code == 204
        del self.transferencias[id_]
        del self.modelo.operaciones[f"tr{id_}"]

    def paso_aleatorio(self) -> str:
        operaciones = [
            (self.crear_transaccion, 4), (self.editar_transaccion, 2), (self.borrar_transaccion, 1),
            (self.crear_transferencia, 3), (self.editar_transferencia, 2), (self.borrar_transferencia, 1),
        ]
        operacion = self.azar.choices([o for o, _ in operaciones], weights=[p for _, p in operaciones])[0]
        operacion()
        return operacion.__name__


# ---------------------------------------------------------------------------
# Comprobaciones
# ---------------------------------------------------------------------------
def _decimales(filas: list[dict], clave: str, campo: str) -> dict[str, Decimal]:
    return {fila[clave]: Decimal(fila[campo]) for fila in filas}


def comprobar_saldos(client: TestClient, modelo: Modelo, contexto: str) -> None:
    """Saldo de cada cuenta = inicial + ingresos − gastos ± transferencias; total = suma convertida."""
    resumen = client.get("/dashboard/resumen").json()
    saldos = {c["cuenta_id"]: Decimal(c["saldo"]) for c in resumen["cuentas"]}
    esperados = {c: modelo.saldo(c) for c in modelo.iniciales}
    assert saldos == esperados, contexto
    assert Decimal(resumen["balance_global"]) == modelo.patrimonio(), contexto


def comprobar_vistas(client: TestClient, modelo: Modelo, contexto: str) -> None:
    """Todas las pantallas cuentan lo mismo: flujo, resumen, categorías, calendario y patrimonio."""
    meses = _meses_hasta_hoy(MESES_VENTANA)
    params = {"hasta_mes": meses[-1], "meses": MESES_VENTANA}
    flujo = client.get("/dashboard/flujo-mensual", params=params).json()
    patrimonio = client.get("/dashboard/patrimonio", params=params).json()

    for mes in meses:
        ingresos, gastos = modelo.total("ingreso", mes), modelo.total("gasto", mes)
        assert _decimales(flujo, "mes_anio", "ingresos")[mes] == ingresos, f"{contexto} · flujo {mes}"
        assert _decimales(flujo, "mes_anio", "gastos")[mes] == gastos, f"{contexto} · flujo {mes}"

        resumen = client.get("/dashboard/resumen", params={"mes_anio": mes}).json()
        assert (Decimal(resumen["ingresos"]), Decimal(resumen["gastos"])) == (ingresos, gastos), contexto

        por_categoria = client.get("/dashboard/gastos-por-categoria", params={"mes_anio": mes}).json()
        assert sum((Decimal(c["total"]) for c in por_categoria), Decimal(0)) == gastos, f"{contexto} · categorías {mes}"

        diarios = client.get("/dashboard/gastos-diarios", params={"mes_anio": mes}).json()
        assert sum((Decimal(d["total"]) for d in diarios), Decimal(0)) == gastos, f"{contexto} · diarios {mes}"

        corte = min(_fin_de_mes(mes), date.today() + timedelta(days=1))
        total = _decimales(patrimonio, "mes_anio", "total")[mes]
        assert total == modelo.patrimonio(antes_de=corte), f"{contexto} · patrimonio {mes}"

    # El último punto de la gráfica de patrimonio es el balance de hoy.
    assert Decimal(patrimonio[-1]["total"]) == modelo.patrimonio(), contexto


def _foto(client: TestClient) -> dict:
    """Todo lo que la app enseña del dinero, para comparar antes y después."""
    params = {"meses": MESES_VENTANA}
    return {
        "resumen": client.get("/dashboard/resumen").json(),
        "flujo": client.get("/dashboard/flujo-mensual", params=params).json(),
        "patrimonio": client.get("/dashboard/patrimonio", params=params).json(),
        "categorias": client.get("/dashboard/gastos-por-categoria").json(),
        "diarios": client.get("/dashboard/gastos-diarios").json(),
        "transacciones": client.get("/transacciones").json(),
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
@pytest.fixture
def escenario_base(client: TestClient, tasas: None, cuenta: dict, categoria_gasto: dict,
                   categoria_ingreso: dict) -> tuple[list[dict], dict[str, dict]]:
    ahorro = client.post("/cuentas", json={"nombre": "Ahorro", "tipo": "debito"}).json()
    revolut = client.post(
        "/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR", "balance_inicial": "50"}
    ).json()
    return [cuenta, ahorro, revolut], {"gasto": categoria_gasto, "ingreso": categoria_ingreso}


@pytest.mark.parametrize("semilla", [1, 2, 3])
def test_saldos_y_vistas_cuadran_con_el_modelo(client: TestClient, escenario_base: tuple, semilla: int) -> None:
    escenario = Escenario(client, semilla, *escenario_base)
    for paso in range(60):
        operacion = escenario.paso_aleatorio()
        contexto = f"semilla {semilla}, paso {paso}: {operacion}"
        comprobar_saldos(client, escenario.modelo, contexto)
        if paso % 20 == 19:  # las vistas son más caras de revisar: cada 20 pasos
            comprobar_vistas(client, escenario.modelo, contexto)


def test_crear_y_borrar_deja_todo_como_estaba(client: TestClient, escenario_base: tuple) -> None:
    escenario = Escenario(client, 7, *escenario_base)
    for _ in range(25):
        escenario.paso_aleatorio()
    antes = _foto(client)
    (banco, _, revolut), categorias = escenario_base
    hoy = date.today().isoformat()

    gasto = client.post("/transacciones", json={
        "monto": "42.10", "moneda": "EUR", "tipo": "gasto", "fecha": hoy,
        "cuenta_id": banco["id"], "categoria_id": categorias["gasto"]["id"],
    }).json()
    assert client.delete(f"/transacciones/{gasto['id']}").status_code == 204

    # Entre monedas y con comisión: al borrarla también debe desaparecer su gasto enlazado.
    transferencia = client.post("/transferencias", json={
        "cuenta_origen_id": banco["id"], "cuenta_destino_id": revolut["id"], "fecha": hoy,
        "monto_origen": "500", "monto_destino": "24.30", "comision": "15",
    }).json()
    assert client.delete(f"/transferencias/{transferencia['id']}").status_code == 204

    assert _foto(client) == antes


def test_transferencia_en_la_misma_moneda_solo_cambia_el_total_por_la_comision(
    client: TestClient, escenario_base: tuple
) -> None:
    (banco, ahorro, _), _ = escenario_base
    antes = Decimal(client.get("/dashboard/resumen").json()["balance_global"])

    datos = {"cuenta_origen_id": banco["id"], "cuenta_destino_id": ahorro["id"], "monto_origen": "123.45",
             "comision": "0.99", "fecha": date.today().isoformat()}
    assert client.post("/transferencias", json=datos).status_code == 201

    despues = Decimal(client.get("/dashboard/resumen").json()["balance_global"])
    assert despues == antes - Decimal("0.99")


def test_sumas_de_miles_de_centimos_son_exactas(session: Session, cuenta: dict, categoria_gasto: dict) -> None:
    """SQLite suma como flotantes (0.1 + 0.1 + 0.1 = 0.30000000000000004); el total debe salir exacto.

    Hay dos redes: SQLAlchemy convierte el SUM a Decimal(12, 2) por el tipo de la
    columna, y saldos.a_decimal() redondea otra vez. Este test falla si caen las dos.
    """
    hoy = date.today()
    importes = [Decimal("0.10"), Decimal("0.20"), Decimal("0.01"), Decimal("0.07")]
    for i in range(10_000):
        monto = importes[i % len(importes)]
        session.add(Transaccion(monto=monto, moneda=Moneda.MXN, tipo=TipoMovimiento.GASTO, fecha=hoy,
                                cuenta_id=cuenta["id"], categoria_id=categoria_gasto["id"],
                                monto_cuenta=monto, monto_principal=monto))
    session.commit()
    esperado = sum(importes, Decimal(0)) * 10_000 / len(importes)  # 950.00

    assert saldos.movimientos_por_cuenta(session)[cuenta["id"]] == -esperado
    assert dashboard.resumen(session, _mes(hoy)).gastos == esperado


def test_cambiar_la_moneda_principal_no_toca_los_importes_originales(
    client: TestClient, escenario_base: tuple
) -> None:
    escenario = Escenario(client, 11, *escenario_base)
    for _ in range(20):
        escenario.paso_aleatorio()
    antes = client.get("/transacciones").json()
    saldos_antes = client.get("/dashboard/resumen").json()["cuentas"]
    total_antes = client.get("/dashboard/resumen").json()["balance_global"]

    assert client.patch("/configuracion", json={"moneda": "EUR"}).status_code == 200
    en_euros = client.get("/dashboard/resumen").json()
    # El mismo dinero contado en euros. Cada cuenta en pesos se redondea a céntimos
    # de euro (±0.005 EUR = ±0.10 MXN), así que se admite esa diferencia por cuenta.
    diferencia = abs(Decimal(en_euros["balance_global"]) * MXN_POR_EUR - Decimal(total_antes))
    assert diferencia <= Decimal("0.10") * len(saldos_antes)
    assert client.patch("/configuracion", json={"moneda": "MXN"}).status_code == 200

    def originales(transacciones: list[dict]) -> dict[int, tuple]:
        return {t["id"]: (t["monto"], t["moneda"], t["monto_cuenta"]) for t in transacciones}

    assert originales(client.get("/transacciones").json()) == originales(antes)
    assert client.get("/dashboard/resumen").json()["cuentas"] == saldos_antes
    assert client.get("/dashboard/resumen").json()["balance_global"] == total_antes
