"""Configuración de moneda, categorías por defecto y migraciones."""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlmodel import Session, SQLModel, select

from app.datos_iniciales import CATEGORIAS_POR_DEFECTO, crear_datos_iniciales
from app.migraciones import aplicar_migraciones
from app.models import Categoria


def test_moneda_por_defecto_y_cambio(client: TestClient) -> None:
    configuracion = client.get("/configuracion").json()
    assert configuracion["moneda"] == "MXN"
    assert configuracion["monedas_activas"] == ["MXN", "USD", "EUR", "GTQ", "HNL"]  # todas
    # Sin transacciones no hace falta ninguna tasa para cambiar la principal
    assert client.patch("/configuracion", json={"moneda": "GTQ"}).json()["moneda"] == "GTQ"
    assert client.get("/configuracion").json()["moneda"] == "GTQ"


def test_moneda_no_soportada_devuelve_422(client: TestClient) -> None:
    assert client.patch("/configuracion", json={"moneda": "BTC"}).status_code == 422


def test_categorias_por_defecto_solo_en_bd_vacia(session: Session) -> None:
    crear_datos_iniciales(session)
    crear_datos_iniciales(session)  # la segunda vez no debe duplicar nada

    categorias = session.exec(select(Categoria)).all()
    assert len(categorias) == len(CATEGORIAS_POR_DEFECTO)


def test_migracion_anade_columnas_y_renombra_tipos() -> None:
    """Simula una BD creada con la versión anterior del modelo Cuenta."""
    engine = create_engine("sqlite://")
    with engine.begin() as conexion:
        conexion.execute(text(
            "CREATE TABLE cuenta (id INTEGER PRIMARY KEY, nombre VARCHAR NOT NULL, "
            "tipo VARCHAR NOT NULL, balance_inicial NUMERIC NOT NULL)"
        ))
        conexion.execute(text("INSERT INTO cuenta VALUES (1, 'Viejo', 'BANCO', 100)"))

    SQLModel.metadata.create_all(engine)  # crea las demás tablas, no toca `cuenta`
    with engine.begin() as conexion:
        aplicar_migraciones(conexion)

    columnas = {c["name"] for c in inspect(engine).get_columns("cuenta")}
    assert {"dia_corte", "dia_pago", "limite_credito", "tasa_rendimiento_anual",
            "fecha_ultimo_rendimiento"} <= columnas
    with engine.connect() as conexion:
        assert conexion.execute(text("SELECT tipo FROM cuenta")).scalar() == "DEBITO"


def test_primeros_pasos_por_defecto_y_desactivar_consejos(client: TestClient) -> None:
    configuracion = client.get("/configuracion").json()
    assert (configuracion["tutorial_visto"], configuracion["bienvenida_cerrada"]) == (False, False)
    assert configuracion["mostrar_consejos"] is True

    cambiada = client.patch("/configuracion", json={"tutorial_visto": True, "mostrar_consejos": False}).json()
    assert cambiada["tutorial_visto"] is True
    assert cambiada["mostrar_consejos"] is False


def _bd_sin_columnas_de_primeros_pasos(con_cuentas: bool):
    """Una BD de antes del tutorial: `configuracion` sin sus columnas nuevas."""
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conexion:
        for columna in ("tutorial_visto", "bienvenida_cerrada", "mostrar_consejos"):
            conexion.execute(text(f"ALTER TABLE configuracion DROP COLUMN {columna}"))
        conexion.execute(text("INSERT INTO configuracion (id, moneda) VALUES (1, 'MXN')"))
        if con_cuentas:
            conexion.execute(text(
                "INSERT INTO cuenta (id, nombre, tipo, moneda, balance_inicial) VALUES (1, 'BBVA', 'DEBITO', 'MXN', 0)"
            ))
    return engine


def test_quien_ya_usaba_la_app_no_ve_el_tutorial() -> None:
    engine = _bd_sin_columnas_de_primeros_pasos(con_cuentas=True)
    with engine.begin() as conexion:
        aplicar_migraciones(conexion)
        aplicar_migraciones(conexion)  # repetirla no cambia nada
    with engine.connect() as conexion:
        fila = conexion.execute(text("SELECT tutorial_visto, bienvenida_cerrada FROM configuracion")).one()
    assert tuple(fila) == (1, 1)


def test_una_bd_sin_cuentas_si_ve_el_tutorial() -> None:
    engine = _bd_sin_columnas_de_primeros_pasos(con_cuentas=False)
    with engine.begin() as conexion:
        aplicar_migraciones(conexion)
    with engine.connect() as conexion:
        assert conexion.execute(text("SELECT tutorial_visto FROM configuracion")).scalar() is None
