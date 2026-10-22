# Backend (`backend/app/`)

Python 3.12, FastAPI, SQLModel, Pydantic, Uvicorn. BD: SQLite en `data/finance.db` (datos reales).
Capas: routers (HTTP, sin lógica) → services (reglas de negocio) → models/schemas.

## Convenciones
- Español sin tildes ni ñ en identificadores (`mes_anio`, `/transacciones`).
- Por entidad: `XBase` + tabla `X` en models.py; `XCreate`/`XRead`/`XUpdate` en schemas.py.
- Importes `Decimal` (12,2) positivos: el signo lo da `tipo`. PATCH vía `cambios_parciales()`.
- Servicios lanzan `ErrorDeDominio` (services/errores.py); main.py → `{"detail": ...}` con
  códigos semánticos (400, 404, 409, 422…) y mensajes legibles en español.
- Arranque (`init_db`): `create_all` + migraciones.py (solo columnas *nullable*/renombrar valores)
  + datos_iniciales.py. Nunca borrar `finance.db`: los cambios de esquema deben ser aditivos.
- Dependencias: requirements.txt + constraints.txt (versiones exactas); pip-audit en CI.

## Dominio
- Cuentas: campos por tipo en `_normalizar_por_tipo`; tarjeta: saldo negativo = deuda; subcuentas
  con `cuenta_padre_id` (`MAX_NIVELES_SUBCUENTAS`). Saldos solo vía `saldos.movimientos_por_cuenta`.
- Transferencias: no son ingreso/gasto; su comisión es una Transaccion con `transferencia_id`.
- Deudas: préstamo y abonos mueven saldos (`saldos._FUENTES`); sin cuenta, es un apunte.
- Divisas: tasas diarias por USD en `tasacambio` (manual > api; días pasados del BCE con
  `asegurar_tasas_historicas`, que no hace commit). `completar_montos()` → `monto_cuenta` (saldo)
  y `monto_principal` (dashboard) con la tasa de su fecha. Sumar esos campos, nunca `monto`.
- Recurrentes (suscripciones, ingresos): `siguiente_fecha` + `Calendario` en periodicidad.py.
- Presupuestos: cada uno en su `moneda` (`dashboard.progreso_presupuestos`).
- Metas: progreso en `metas._con_progreso` (saldo o aportaciones); `fecha_cumplida` persiste.
- Avisos: services/notificaciones.py, al vuelo con clave estable; solo se guardan las leídas.
- Búsqueda: `_filtrar()` en services/transacciones.py; texto con `sin_acentos()` (database.py).
- Importar: `lector_extractos.py` (puro: bytes → fecha, importe con signo, concepto; con límites
  anti bomba ZIP) e `importaciones.py` (vista previa sin guardar; confirmar todo o nada).
- Mes financiero: services/mes_financiero.py (`dia_inicio_mes`).
- Acceso: un usuario (scrypt) + cookie HttpOnly `sesion`; `requiere_sesion` en main.py.
  Olvido: `python -m app.restablecer_contrasena`. Defensas HTTP de producción: seguridad_http.py.

## Tests (`backend/tests/`)
- Cada test usa una BD en memoria (conftest.py); `client` simula sesión, `cliente_sin_sesion` no.
- Nunca internet: `TASAS_AUTOMATICAS=false` y la descarga histórica bloqueada en conftest.
- Al arreglar un fallo, primero un test que lo reproduzca; comprobar que falla sin el arreglo.
- Lo financiero lleva tests de propiedades (test_propiedades.py: modelo de referencia).

## Comandos (Git Bash, raíz del repo)
- Todo: `scripts/verificar.sh`. Solo tests:
  `MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/backend:/app" -w /app appfinanzas-backend sh -c "pip install -q -r requirements-dev.txt && pytest -q"`
- Rendimiento: igual, con `python -m benchmarks.rendimiento 10000 50000` (BD temporal).
  Medir antes y después; no optimizar sin una medición que lo pida.
