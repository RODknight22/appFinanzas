"""Datos que la app necesita la primera vez que arranca."""

from sqlmodel import Session, select

from app.models import Categoria, Configuracion, TipoMovimiento

# Nombre de la categoría donde se anotan los rendimientos de las cuentas.
CATEGORIA_RENDIMIENTOS = "Rendimientos"
# Categoría de gasto donde se anotan las comisiones de las transferencias.
CATEGORIA_COMISIONES = "Comisiones"

GASTO, INGRESO = TipoMovimiento.GASTO, TipoMovimiento.INGRESO

# (nombre, tipo, icono de Lucide, color)
CATEGORIAS_POR_DEFECTO: list[tuple[str, TipoMovimiento, str, str]] = [
    ("Supermercado", GASTO, "shopping-cart", "#10b981"),
    ("Restaurantes", GASTO, "utensils", "#f97316"),
    ("Transporte", GASTO, "car", "#3b82f6"),
    ("Vivienda", GASTO, "house", "#8b5cf6"),
    ("Servicios", GASTO, "zap", "#f59e0b"),
    ("Salud", GASTO, "heart-pulse", "#ef4444"),
    ("Entretenimiento", GASTO, "film", "#ec4899"),
    ("Ropa", GASTO, "shirt", "#06b6d4"),
    ("Educación", GASTO, "graduation-cap", "#84cc16"),
    ("Suscripciones", GASTO, "repeat", "#8b5cf6"),
    ("Mascotas", GASTO, "paw-print", "#f97316"),
    ("Viajes", GASTO, "plane", "#06b6d4"),
    (CATEGORIA_COMISIONES, GASTO, "receipt", "#94a3b8"),
    ("Otros gastos", GASTO, "circle", "#64748b"),
    ("Sueldo", INGRESO, "briefcase", "#10b981"),
    ("Freelance", INGRESO, "laptop", "#3b82f6"),
    (CATEGORIA_RENDIMIENTOS, INGRESO, "trending-up", "#84cc16"),
    ("Regalos", INGRESO, "gift", "#ec4899"),
    ("Otros ingresos", INGRESO, "banknote", "#64748b"),
]


def crear_datos_iniciales(session: Session) -> None:
    """Crea la configuración y, si no hay ninguna categoría, las de por defecto.

    Solo actúa sobre una BD vacía: si el usuario borra categorías por
    defecto, no vuelven a aparecer al reiniciar.
    """
    if session.get(Configuracion, 1) is None:
        session.add(Configuracion(id=1))

    if session.exec(select(Categoria.id).limit(1)).first() is None:
        for nombre, tipo, icono, color in CATEGORIAS_POR_DEFECTO:
            session.add(Categoria(nombre=nombre, tipo=tipo, icono=icono, color=color))

    session.commit()
