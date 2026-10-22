"""Copias de seguridad: la BD completa y un CSV de movimientos para abrir en Excel.

Solo lectura: nada de aquí cambia la BD original.
"""

import csv
import io
import sqlite3
import tempfile
from decimal import Decimal
from pathlib import Path

from sqlmodel import Session, col, select

from app.models import Categoria, Cuenta, TipoMovimiento, Transaccion
from app.services.configuracion import moneda_principal

# Excel interpreta como fórmula una celda que empieza por estos caracteres
# ("=HYPERLINK(...)" en unas notas podría ejecutar algo al abrir el CSV).
_INICIO_DE_FORMULA = ("=", "+", "-", "@", "\t", "\r")


def copia_bd(session: Session) -> bytes:
    """Copia completa y coherente de la BD, sin las sesiones abiertas.

    No basta con leer finance.db: con WAL, lo último guardado puede estar aún en
    finance.db-wal. La API de backup de SQLite copia la BD tal como la ve una lectura.
    """
    # La conexión sqlite3 que hay debajo de la sesión de SQLAlchemy.
    origen = session.connection().connection.driver_connection
    with tempfile.TemporaryDirectory() as carpeta:
        ruta = Path(carpeta) / "copia.db"
        destino = sqlite3.connect(ruta)
        try:
            origen.backup(destino)
            # Las cookies de sesión son de este navegador: la copia no debe abrir la app.
            destino.execute("DELETE FROM sesion")
            destino.commit()
            # Un solo archivo autosuficiente (sin -wal) y sin restos de lo borrado.
            destino.execute("PRAGMA journal_mode=DELETE")
            destino.execute("VACUUM")
        finally:
            # En Windows no se puede leer ni borrar un archivo con la conexión abierta.
            destino.close()
        return ruta.read_bytes()


def _texto(valor: str | None) -> str:
    """Texto seguro para Excel: con ' delante si parecería una fórmula."""
    if not valor:
        return ""
    return f"'{valor}" if valor.startswith(_INICIO_DE_FORMULA) else valor


def _importe(valor: Decimal | None) -> str:
    # Coma decimal: el Excel en español leería "12.50" como texto o como fecha.
    return "" if valor is None else str(valor).replace(".", ",")


def exportar_csv(session: Session) -> bytes:
    """Todas las transacciones (más antiguas primero) en CSV para Excel en español."""
    principal = moneda_principal(session)
    filas = session.exec(
        select(Transaccion, Cuenta, Categoria)
        .join(Cuenta, col(Transaccion.cuenta_id) == col(Cuenta.id))
        .join(Categoria, col(Transaccion.categoria_id) == col(Categoria.id))
        .order_by(col(Transaccion.fecha), col(Transaccion.id))
    ).all()

    salida = io.StringIO()
    # ";" es el separador que espera Excel cuando la coma es el separador decimal.
    escritor = csv.writer(salida, delimiter=";", lineterminator="\r\n")
    escritor.writerow([
        "Fecha", "Tipo", "Cuenta", "Categoría", "Notas", "Importe", "Moneda",
        "Importe en la cuenta", "Moneda de la cuenta", f"Importe en {principal.value}",
    ])
    for transaccion, cuenta, categoria in filas:
        moneda_cuenta = cuenta.moneda or principal
        escritor.writerow([
            transaccion.fecha.isoformat(),
            "Gasto" if transaccion.tipo == TipoMovimiento.GASTO else "Ingreso",
            _texto(cuenta.nombre),
            _texto(categoria.nombre),
            _texto(transaccion.notas),
            _importe(transaccion.monto),
            (transaccion.moneda or moneda_cuenta).value,
            _importe(transaccion.monto_cuenta),
            moneda_cuenta.value,
            _importe(transaccion.monto_principal),
        ])
    # utf-8-sig añade la marca BOM: sin ella Excel muestra "CategorÃ­a".
    return salida.getvalue().encode("utf-8-sig")
