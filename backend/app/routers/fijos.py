"""Endpoints HTTP comunes a los fijos (ingresos recurrentes y pagos fijos)."""

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Query

from app.database import SessionDep
from app.models import Moneda, TipoMovimiento
from app.schemas import FijoCandidato
from app.services import fijos as servicio

router = APIRouter(prefix="/fijos", tags=["Fijos"])


@router.get("/candidatos", response_model=list[FijoCandidato])
def candidatos(
    session: SessionDep,
    tipo: TipoMovimiento,
    monto: Annotated[Decimal, Query(gt=0)],
    cuenta_id: int,
    fecha: date,
    moneda: Moneda | None = None,
):
    """Fijos que podrían ser este movimiento (mismo tipo, fecha e importe cercanos), el más parecido primero.

    Sin `moneda`, la de la cuenta. Para preguntar "¿es el cobro de tu nómina?" al anotarlo.
    """
    return servicio.candidatos(session, tipo, monto, cuenta_id, fecha, moneda)
