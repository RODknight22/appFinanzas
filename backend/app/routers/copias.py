"""Descargas de copia de seguridad: la BD completa y los movimientos en CSV."""

from datetime import date

from fastapi import APIRouter, Response

from app.database import SessionDep
from app.services import copias as servicio

router = APIRouter(prefix="/copias", tags=["Copias de seguridad"])


def _descarga(contenido: bytes, tipo: str, nombre: str) -> Response:
    # "attachment": el navegador lo guarda como archivo en vez de mostrarlo.
    # "no-store": son todos tus datos; que no queden en la caché del navegador.
    return Response(
        content=contenido,
        media_type=tipo,
        headers={"Content-Disposition": f'attachment; filename="{nombre}"', "Cache-Control": "no-store"},
    )


@router.get("/bd", response_class=Response)
def descargar_bd(session: SessionDep) -> Response:
    """La BD completa. Para restaurarla: parar la app y sustituir data/finance.db por este archivo."""
    nombre = f"appfinanzas-{date.today().isoformat()}.db"
    return _descarga(servicio.copia_bd(session), "application/vnd.sqlite3", nombre)


@router.get("/movimientos.csv", response_class=Response)
def descargar_csv(session: SessionDep) -> Response:
    """Todas las transacciones en CSV, listo para abrir en Excel."""
    nombre = f"movimientos-{date.today().isoformat()}.csv"
    return _descarga(servicio.exportar_csv(session), "text/csv; charset=utf-8", nombre)
