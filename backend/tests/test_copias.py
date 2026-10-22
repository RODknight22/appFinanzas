"""Copias de seguridad: restaurar la copia da los mismos datos; el CSV es seguro para Excel."""

import csv
import io
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select, text

from app.database import get_session
from app.main import app
from app.models import Cuenta, Sesion
from app.services import copias


def _saldos(client: TestClient) -> dict[str, str]:
    cuentas = client.get("/dashboard/resumen").json()["cuentas"]
    return {c["nombre"]: c["saldo"] for c in cuentas}


def _gasto(client: TestClient, cuenta: dict, categoria: dict, monto: str, notas: str | None = None) -> None:
    datos = {"monto": monto, "tipo": "gasto", "fecha": "2026-10-01", "notas": notas,
             "categoria_id": categoria["id"], "cuenta_id": cuenta["id"]}
    respuesta = client.post("/transacciones", json=datos)
    assert respuesta.status_code == 201, respuesta.text


def test_restaurar_la_copia_da_los_mismos_saldos(
    client: TestClient, session: Session, cuenta: dict, categoria_gasto: dict, tasas: None, tmp_path: Path
) -> None:
    revolut = client.post("/cuentas", json={"nombre": "Revolut", "tipo": "debito", "moneda": "EUR"}).json()
    _gasto(client, cuenta, categoria_gasto, "120.50")
    _gasto(client, revolut, categoria_gasto, "9.99")
    client.post("/transferencias", json={"cuenta_origen_id": cuenta["id"], "cuenta_destino_id": revolut["id"],
                                         "monto_origen": "200", "fecha": "2026-10-02"})
    session.add(Sesion(token_hash="abc", creada=datetime.now(), expira=datetime.now() + timedelta(days=1)))
    session.commit()
    antes = _saldos(client)

    respuesta = client.get("/copias/bd")
    assert respuesta.status_code == 200
    assert "attachment" in respuesta.headers["content-disposition"]
    archivo = tmp_path / "restaurada.db"
    archivo.write_bytes(respuesta.content)

    # "Restaurar": la app pasa a usar el archivo descargado como su BD.
    restaurada = create_engine(f"sqlite:///{archivo.as_posix()}")
    with Session(restaurada) as sesion_restaurada:
        app.dependency_overrides[get_session] = lambda: sesion_restaurada
        assert _saldos(client) == antes
        # La copia no lleva las sesiones abiertas: no sirve para entrar sin contraseña.
        assert sesion_restaurada.exec(select(Sesion)).all() == []
    restaurada.dispose()


def test_la_copia_incluye_lo_que_aun_esta_en_el_wal(tmp_path: Path) -> None:
    """En producción (WAL) lo recién guardado vive en finance.db-wal hasta el siguiente checkpoint."""
    motor = create_engine(f"sqlite:///{(tmp_path / 'finance.db').as_posix()}")
    SQLModel.metadata.create_all(motor)
    with Session(motor) as session:
        session.exec(text("PRAGMA journal_mode=WAL"))  # type: ignore[call-overload]
        session.add(Cuenta(nombre="Recién creada", tipo="debito", moneda="EUR"))
        session.commit()
        contenido = copias.copia_bd(session)
    motor.dispose()

    copia = tmp_path / "copia.db"
    copia.write_bytes(contenido)
    conexion = sqlite3.connect(copia)
    try:
        assert conexion.execute("SELECT nombre FROM cuenta").fetchall() == [("Recién creada",)]
        # Archivo autosuficiente: modo clásico, no necesita un -wal al lado.
        assert conexion.execute("PRAGMA journal_mode").fetchone() == ("delete",)
    finally:
        conexion.close()


def test_csv_para_excel_sin_formulas(client: TestClient, cuenta: dict, categoria_gasto: dict) -> None:
    _gasto(client, cuenta, categoria_gasto, "1234.50", notas='=HYPERLINK("http://malo")')
    _gasto(client, cuenta, categoria_gasto, "3", notas="Café")

    respuesta = client.get("/copias/movimientos.csv")

    assert respuesta.status_code == 200
    assert respuesta.content.startswith(b"\xef\xbb\xbf")  # BOM: Excel lee bien las tildes
    filas = list(csv.reader(io.StringIO(respuesta.content.decode("utf-8-sig")), delimiter=";"))
    assert filas[0][:7] == ["Fecha", "Tipo", "Cuenta", "Categoría", "Notas", "Importe", "Moneda"]
    assert filas[1][:7] == ["2026-10-01", "Gasto", "Banco", "Comida", '\'=HYPERLINK("http://malo")', "1234,50", "MXN"]
    assert filas[2][4] == "Café"
    assert len(filas) == 3


def test_texto_que_parece_formula_lleva_apostrofo() -> None:
    for peligroso in ("=1+1", "+34 600", "-2", "@SUM(A1)", "\tx"):
        assert copias._texto(peligroso) == f"'{peligroso}"
    assert copias._texto("Mercadona") == "Mercadona"
    assert copias._texto(None) == ""


def test_sin_sesion_no_se_descarga_nada(cliente_sin_sesion: TestClient) -> None:
    assert cliente_sin_sesion.get("/copias/bd").status_code == 401
    assert cliente_sin_sesion.get("/copias/movimientos.csv").status_code == 401
