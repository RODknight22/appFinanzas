"""Mide cuánto tardan los endpoints más usados con muchos datos.

Crea una BD temporal (nunca toca data/finance.db) con N transacciones repartidas
en 10 años, 5 cuentas en MXN y EUR, transferencias y tasas diarias, y mide la
mediana de varias llamadas a cada endpoint del dashboard y de la búsqueda.

Uso (Git Bash, desde la raíz del repo):
    MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/backend:/app" -w /app appfinanzas-backend \
        python -m benchmarks.rendimiento 10000 50000
"""

import os
import sys
import tempfile

# Antes de importar la app: la BD vive en una carpeta temporal y sin internet.
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="benchmark-")
os.environ["SQLITE_WAL"] = "true"  # como en producción
os.environ["TASAS_AUTOMATICAS"] = "false"

import random
import statistics
import time
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session, delete, select

from app.database import engine, init_db
from app.dependencias import requiere_sesion
from app.main import app
from app.models import (
    Categoria, Cuenta, Moneda, OrigenTasa, TasaCambio, TipoCuenta, TipoMovimiento, Transaccion, Transferencia,
    Usuario,
)

HOY = date.today()
ANIOS = 10
REPETICIONES = 7
TRANSFERENCIAS_POR_TRANSACCION = 0.05


def _sembrar(session: Session, cantidad: int, azar: random.Random) -> None:
    """Rellena la BD con `cantidad` transacciones (y un 5 % de transferencias)."""
    for tabla in (Transaccion, Transferencia, TasaCambio, Cuenta):
        session.exec(delete(tabla))

    inicio = HOY - timedelta(days=365 * ANIOS)
    dias = [inicio + timedelta(days=d) for d in range((HOY - inicio).days + 1)]
    # Tasas diarias con algo de ruido: así la búsqueda de "la tasa de ese día" es realista.
    for dia in dias:
        session.add(TasaCambio(moneda=Moneda.MXN, por_usd=Decimal(azar.uniform(16, 21)).quantize(Decimal("0.0001")),
                               fecha=dia, origen=OrigenTasa.API))
        session.add(TasaCambio(moneda=Moneda.EUR, por_usd=Decimal(azar.uniform(0.85, 0.95)).quantize(Decimal("0.0001")),
                               fecha=dia, origen=OrigenTasa.API))

    cuentas = [
        Cuenta(nombre="BBVA", tipo=TipoCuenta.DEBITO, moneda=Moneda.MXN, balance_inicial=Decimal("50000")),
        Cuenta(nombre="Nu", tipo=TipoCuenta.DEBITO, moneda=Moneda.MXN, balance_inicial=Decimal("10000")),
        Cuenta(nombre="Revolut", tipo=TipoCuenta.DEBITO, moneda=Moneda.EUR, balance_inicial=Decimal("3000")),
        Cuenta(nombre="Efectivo", tipo=TipoCuenta.EFECTIVO, moneda=Moneda.EUR),
        Cuenta(nombre="Tarjeta", tipo=TipoCuenta.CREDITO, moneda=Moneda.EUR, dia_corte=5, dia_pago=25,
               limite_credito=Decimal("2000")),
    ]
    session.add_all(cuentas)
    session.flush()
    categorias = session.exec(select(Categoria)).all()
    por_tipo = {tipo: [c for c in categorias if c.tipo == tipo] for tipo in TipoMovimiento}

    notas = ["Mercadona", "Uber", "Netflix", "Alquiler", "Cena con amigos", "Gasolina", "Farmacia", None]
    for _ in range(cantidad):
        tipo = TipoMovimiento.GASTO if azar.random() < 0.85 else TipoMovimiento.INGRESO
        cuenta = azar.choice(cuentas)
        monto = Decimal(azar.randint(100, 300000)) / 100
        # Importes convertidos aproximados: el benchmark mide velocidad, no exactitud.
        en_mxn = monto * 20 if cuenta.moneda == Moneda.EUR else monto
        session.add(Transaccion(
            monto=monto, moneda=cuenta.moneda, tipo=tipo, fecha=azar.choice(dias), notas=azar.choice(notas),
            cuenta_id=cuenta.id, categoria_id=azar.choice(por_tipo[tipo]).id,
            monto_cuenta=monto, monto_principal=en_mxn,
        ))
    for _ in range(int(cantidad * TRANSFERENCIAS_POR_TRANSACCION)):
        origen, destino = azar.sample(cuentas, 2)
        monto = Decimal(azar.randint(1000, 500000)) / 100
        session.add(Transferencia(cuenta_origen_id=origen.id, cuenta_destino_id=destino.id, monto_origen=monto,
                                  monto_destino=monto, fecha=azar.choice(dias)))
    session.commit()


def _peticiones() -> dict[str, tuple[str, dict]]:
    mes = HOY.strftime("%Y-%m")
    return {
        # Las 11 que lanza el dashboard al abrirse (DashboardPage.tsx).
        "resumen": ("/dashboard/resumen", {"mes_anio": mes}),
        "flujo-mensual (6)": ("/dashboard/flujo-mensual", {"hasta_mes": mes, "meses": 6}),
        "gastos-por-categoria": ("/dashboard/gastos-por-categoria", {"mes_anio": mes}),
        "presupuestos": ("/dashboard/presupuestos", {"mes_anio": mes}),
        "suscripciones": ("/suscripciones", {"proximos_dias": 7}),
        "cuentas": ("/cuentas", {}),
        "últimas 5": ("/transacciones", {"limit": 5}),
        "categorias": ("/categorias", {}),
        "metas": ("/metas", {}),
        "patrimonio (12)": ("/dashboard/patrimonio", {"hasta_mes": mes, "meses": 12}),
        "gastos-diarios": ("/dashboard/gastos-diarios", {"mes_anio": mes}),
        # Página de transacciones.
        "buscar (página 1)": ("/transacciones/buscar", {"limit": 50}),
        "buscar texto": ("/transacciones/buscar", {"texto": "farmacia", "limit": 50}),
    }


def _medir(client: TestClient, ruta: str, params: dict) -> float:
    """Mediana en milisegundos (la primera llamada se descarta: calienta cachés)."""
    assert client.get(ruta, params=params).status_code == 200
    tiempos = []
    for _ in range(REPETICIONES):
        inicio = time.perf_counter()
        client.get(ruta, params=params)
        tiempos.append((time.perf_counter() - inicio) * 1000)
    return statistics.median(tiempos)


def main(cantidades: list[int]) -> None:
    init_db()
    app.dependency_overrides[requiere_sesion] = lambda: Usuario(usuario="benchmark", password_hash="")
    client = TestClient(app)
    peticiones = _peticiones()
    resultados: dict[int, dict[str, float]] = {}

    for cantidad in cantidades:
        inicio = time.perf_counter()
        with Session(engine) as session:
            _sembrar(session, cantidad, random.Random(cantidad))
        print(f"BD con {cantidad:,} transacciones creada en {time.perf_counter() - inicio:.0f} s", file=sys.stderr)
        resultados[cantidad] = {nombre: _medir(client, ruta, params) for nombre, (ruta, params) in peticiones.items()}

    ancho = max(map(len, peticiones))
    print(f"\n{'ms (mediana)':<{ancho}}" + "".join(f"{c:>10,}" for c in cantidades))
    for nombre in peticiones:
        print(f"{nombre:<{ancho}}" + "".join(f"{resultados[c][nombre]:>10.1f}" for c in cantidades))
    dashboard = list(peticiones)[:11]
    for etiqueta, agregado in (("dashboard: la más lenta", max), ("dashboard: suma de las 11", sum)):
        print(f"{etiqueta:<{ancho}}" + "".join(
            f"{agregado(resultados[c][n] for n in dashboard):>10.1f}" for c in cantidades))


if __name__ == "__main__":
    main([int(n) for n in sys.argv[1:]] or [10_000, 50_000])
