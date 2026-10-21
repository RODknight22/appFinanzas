"""Migraciones mínimas que se aplican al arrancar, sin herramientas externas.

`create_all` crea tablas nuevas, pero no modifica las que ya existen. Para no
obligar a borrar la base de datos cada vez que un modelo gana un campo,
aquí añadimos las columnas que falten.

Limitación consciente: solo se soportan cambios *aditivos* con columnas
opcionales (nullable). Renombrar o borrar columnas requeriría una herramienta
como Alembic; si llega ese momento, conviene adoptarla.
"""

from sqlalchemy import Connection, inspect, text
from sqlmodel import SQLModel

# Valores de TipoCuenta que se renombraron: {valor antiguo: valor nuevo}.
# SQLAlchemy guarda en la BD el *nombre* del Enum (p. ej. "BANCO").
_RENOMBRES_TIPO_CUENTA = {"BANCO": "DEBITO", "TARJETA": "CREDITO"}


def _anadir_columnas_nuevas(conexion: Connection) -> None:
    inspector = inspect(conexion)
    for tabla in SQLModel.metadata.sorted_tables:
        if not inspector.has_table(tabla.name):
            continue  # tabla nueva: ya la creó create_all
        existentes = {columna["name"] for columna in inspector.get_columns(tabla.name)}
        for columna in tabla.columns:
            if columna.name in existentes:
                continue
            if not columna.nullable:
                raise RuntimeError(
                    f"La columna obligatoria {tabla.name}.{columna.name} no existe en la BD. "
                    "Solo se migran automáticamente columnas opcionales."
                )
            tipo_sql = columna.type.compile(dialect=conexion.dialect)
            conexion.execute(text(f"ALTER TABLE {tabla.name} ADD COLUMN {columna.name} {tipo_sql}"))


def _renombrar_tipos_de_cuenta(conexion: Connection) -> None:
    for antiguo, nuevo in _RENOMBRES_TIPO_CUENTA.items():
        conexion.execute(
            text("UPDATE cuenta SET tipo = :nuevo WHERE tipo = :antiguo"),
            {"nuevo": nuevo, "antiguo": antiguo},
        )


def _rellenar_monedas(conexion: Connection) -> None:
    """Antes de las divisas todo estaba en la moneda principal: así lo marcamos.

    Solo toca filas con la columna vacía, así que repetirlo no cambia nada.
    """
    principal = "COALESCE((SELECT moneda FROM configuracion WHERE id = 1), 'MXN')"
    conexion.execute(text(f"UPDATE cuenta SET moneda = {principal} WHERE moneda IS NULL"))
    conexion.execute(text(f"UPDATE suscripcion SET moneda = {principal} WHERE moneda IS NULL"))
    conexion.execute(text(f"UPDATE presupuesto SET moneda = {principal} WHERE moneda IS NULL"))
    conexion.execute(text(
        "UPDATE transaccion SET moneda = (SELECT moneda FROM cuenta WHERE cuenta.id = transaccion.cuenta_id) "
        "WHERE moneda IS NULL"
    ))
    conexion.execute(text("UPDATE transaccion SET monto_cuenta = monto WHERE monto_cuenta IS NULL"))
    conexion.execute(text("UPDATE transaccion SET monto_principal = monto WHERE monto_principal IS NULL"))


def aplicar_migraciones(conexion: Connection) -> None:
    """Se ejecuta dentro de una transacción: si algo falla, no se aplica nada."""
    _anadir_columnas_nuevas(conexion)
    _renombrar_tipos_de_cuenta(conexion)
    _rellenar_monedas(conexion)
