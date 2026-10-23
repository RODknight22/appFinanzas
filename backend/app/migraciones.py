"""Migraciones mínimas que se aplican al arrancar, sin herramientas externas.

`create_all` crea tablas nuevas, pero no modifica las que ya existen. Para no
obligar a borrar la base de datos cada vez que un modelo gana un campo,
aquí añadimos las columnas que falten.

Limitación consciente: solo se soportan cambios *aditivos* con columnas
opcionales (nullable). Renombrar o borrar columnas requeriría una herramienta
como Alembic; si llega ese momento, conviene adoptarla.
"""

import sqlite3
from contextlib import closing
from datetime import date
from pathlib import Path

from sqlalchemy import Connection, inspect, text
from sqlmodel import SQLModel

# Valores de TipoCuenta que se renombraron: {valor antiguo: valor nuevo}.
# SQLAlchemy guarda en la BD el *nombre* del Enum (p. ej. "BANCO").
_RENOMBRES_TIPO_CUENTA = {"BANCO": "DEBITO", "TARJETA": "CREDITO"}


def _anadir_columnas_nuevas(conexion: Connection) -> set[str]:
    """Añade las columnas que falten y devuelve cuáles ("tabla.columna")."""
    anadidas: set[str] = set()
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
            anadidas.add(f"{tabla.name}.{columna.name}")
    return anadidas


def _crear_indices_que_falten(conexion: Connection) -> None:
    """`ADD COLUMN` no crea el índice de la columna (`index=True`): sin esto, una BD que
    ganó `transaccion.transferencia_id` por migración lo buscaría recorriendo la tabla."""
    for tabla in SQLModel.metadata.sorted_tables:
        for indice in tabla.indexes:
            indice.create(conexion, checkfirst=True)


def hay_columnas_pendientes(conexion: Connection) -> bool:
    """¿Le falta a la BD alguna columna del modelo? (es decir, ¿va a migrarse?)."""
    inspector = inspect(conexion)
    for tabla in SQLModel.metadata.sorted_tables:
        if inspector.has_table(tabla.name):
            existentes = {columna["name"] for columna in inspector.get_columns(tabla.name)}
            if any(columna.name not in existentes for columna in tabla.columns):
                return True
    return False


def copia_antes_de_migrar(ruta_bd: Path, hoy: date | None = None) -> Path:
    """Copia la BD junto a ella antes de cambiar su estructura.

    SQLite no deshace un `ALTER TABLE` a medias dentro de la transacción de pysqlite: si
    una migración fallara, esta copia es la vuelta atrás. Se usa la API de copia de SQLite
    (como en las copias de Ajustes), que es segura aunque la BD esté en modo WAL.
    """
    destino = ruta_bd.with_name(f"{ruta_bd.stem}.antes-de-migrar-{(hoy or date.today()).isoformat()}.db")
    with closing(sqlite3.connect(ruta_bd)) as origen, closing(sqlite3.connect(destino)) as copia:
        origen.backup(copia)
    return destino


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


def _saltar_primeros_pasos_si_ya_se_usaba(conexion: Connection, anadidas: set[str]) -> None:
    """Quien ya usaba la app antes del tutorial no necesita el asistente ni la bienvenida.

    Solo al añadir la columna (una vez): después, el valor lo decide el usuario.
    """
    if "configuracion.tutorial_visto" not in anadidas:
        return
    conexion.execute(text(
        "UPDATE configuracion SET tutorial_visto = 1, bienvenida_cerrada = 1 WHERE EXISTS (SELECT 1 FROM cuenta)"
    ))


def aplicar_migraciones(conexion: Connection) -> None:
    """Se ejecuta dentro de una transacción. Ojo: en SQLite un `ALTER TABLE` no se deshace
    si algo falla después; por eso init_db copia antes la BD si hay columnas pendientes."""
    anadidas = _anadir_columnas_nuevas(conexion)
    _crear_indices_que_falten(conexion)
    _saltar_primeros_pasos_si_ya_se_usaba(conexion, anadidas)
    _renombrar_tipos_de_cuenta(conexion)
    _rellenar_monedas(conexion)
