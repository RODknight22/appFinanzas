"""Borra el usuario y sus sesiones para poder crear uno nuevo (contraseña olvidada).

Uso:  docker compose exec backend python -m app.restablecer_contrasena

No toca cuentas, transacciones ni ningún otro dato.
"""

from sqlmodel import Session, delete

from app.database import engine, init_db
from app.models import Sesion, Usuario


def main() -> None:
    init_db()
    with Session(engine) as session:
        session.exec(delete(Sesion))
        session.exec(delete(Usuario))
        session.commit()
    print("Usuario eliminado. Abre la app y crea un usuario y contraseña nuevos.")


if __name__ == "__main__":
    main()
