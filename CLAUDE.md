# Personal Finance App

## Project Overview
App web local de finanzas personales, mantenible, legible y modular. El desarrollador (Rodrigo,
mexicano que vive en España: recibe dinero en MXN y gasta en EUR) aprende a programar supervisando
el código. Hablarle en español, explicar el diseño antes de cambios grandes, avanzar por piezas.

## Tech Stack
- Backend: Python 3.12, FastAPI, SQLModel, Pydantic, Uvicorn. BD: SQLite en `data/finance.db`.
- Frontend: React 18 + Vite + TypeScript, Tailwind v4 (tokens), Recharts, Lucide, @dnd-kit, Manrope.
- Desarrollo: Docker Compose `backend` (:8000) y `frontend` (:5173, proxy `/api` → backend).
- Producción: `app/servidor.py` (API en `/api` + web compilada, `ProteccionLocal`), `lanzador.py`
  (ejecutable PyInstaller, empaquetado/) y Dockerfile raíz. Release: tag `v*` → .github/workflows.

## Funcionalidades actuales
Transacciones (búsqueda sin tildes, filtros en URL, paginación), transferencias (comisión, pago de
tarjeta), metas de ahorro (cuenta o aportaciones, celebraciones), suscripciones, presupuestos,
dashboard de widgets con gráficas, cuentas, categorías, multidivisa, login y personalización.

## Principios
- Código autodocumentado, modular, tipado estricto; comentarios breves que expliquen el *por qué*.
- Errores HTTP semánticos (400, 401, 404, 409, 422, 429, 503) con mensajes legibles en español.
- Capas: Routers -> Services -> Models/Schemas | Pages -> Components -> api/.

## Convenciones del Backend (`backend/app/`)
- Español sin tildes ni ñ en identificadores (`mes_anio`, `/transacciones`). Routers sin lógica.
- Por entidad: `XBase` + tabla `X` en models.py; `XCreate`/`XRead`/`XUpdate` en schemas.py.
- Importes `Decimal` (12,2) positivos: el signo lo da `tipo`. PATCH vía `cambios_parciales()`.
- Servicios lanzan `ErrorDeDominio` (services/errores.py); main.py → `{"detail": ...}`.
- Arranque (`init_db`): `create_all` + migraciones.py (solo columnas *nullable*/renombrar valores)
  + datos_iniciales.py. Nunca borrar `finance.db`: los cambios de esquema deben ser aditivos.
- Cuentas: campos por tipo en `_normalizar_por_tipo`; saldo de tarjeta negativo = deuda. Saldos
  solo vía `saldos.movimientos_por_cuenta` (transacciones + transferencias, opcional `antes_de`).
- Transferencias: no son ingreso/gasto; su comisión es una Transaccion con `transferencia_id`.
- Metas: progreso en `metas._con_progreso` (saldo o aportaciones); `fecha_cumplida` persiste.
- Divisas: tasas diarias por USD en `tasacambio` (manual > api), expuestas en la principal
  (`en_principal`). Toda transacción pasa por `completar_montos()` → `monto_cuenta` (saldo) y
  `monto_principal` (dashboard) con la tasa de su fecha. Sumar esos campos, nunca `monto`.
- Búsqueda: `_filtrar()` en services/transacciones.py; texto con `sin_acentos()` (database.py).
- Mes financiero: services/mes_financiero.py según `dia_inicio_mes` de la configuración.
- Dependencias: versiones en requirements.txt + constraints.txt; pip-audit y npm audit en CI.
- Acceso: un usuario (scrypt) + cookie HttpOnly `sesion`; `requiere_sesion` en main.py. Tests:
  `client` simula sesión, `cliente_sin_sesion` no. Olvido: `python -m app.restablecer_contrasena`.

## Convenciones del Frontend (`frontend/src/`)
- `api/cliente.ts` es el único que usa `fetch`. `types/` refleja schemas.py (importes = `string`).
- Páginas: `useDatos` + `<Contenido>`; formularios: `useEnvio` + `PieFormulario`; modales con
  estado único (`null | "nueva" | entidad`), `key` para reiniciar y portal a `<body>`.
- `useConfiguracion()` da config, tasas y `convertir`; `formatearDinero(valor, moneda)`.
- Colores: nunca grises fijos (slate/white) sino tokens de index.css (`bg-superficie`,
  `text-tenue`, `border-linea`…) que define cada estilo (fintech, oscuro primero). `*-acento-*`.
- Widgets en dashboard/registroWidgets.tsx (`DatosPanel`; tamaños S/M/L/XL = 1-4 columnas).

## Hoja de ruta
- [x] v1.0.0: ejecutables Windows/Linux + Docker. Versión: `app/version.py` + package.json.
- [ ] Siguiente: importar CSV/Excel + reglas de categorización, ingresos recurrentes, copias de
  seguridad/exportar (ojo: WAL). Mejoras: importes en céntimos, E2E en el repo, notificaciones en
  vez de alert/confirm, tipos ahorro/inversión, Alembic si hay cambios no aditivos, react-router 7,
  firma de ejecutables, más estilos visuales.

## Comandos
- `docker compose up --build` / `docker compose down` (conserva la BD).
- Si cambia package.json: `docker compose up -d --build -V frontend` (-V renueva node_modules).
- Tests (Git Bash, raíz): `MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/backend:/app" -w /app appfinanzas-backend sh -c "pip install -q -r requirements-dev.txt && pytest -q"`
- Tipos: `MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/frontend:/app" -w /app node:22-alpine npx tsc --noEmit`
- Verificación visual: Playwright (`mcr.microsoft.com/playwright:v1.49.1-noble`) contra
  contenedores temporales `fin-test-backend`/`fin-test-frontend` en la red `appfinanzas_default`
  con `DATA_DIR=/tmp/data`: nunca probar sobre los datos reales. Borrarlos al terminar.

## Reglas
- Mantener este documento al día: menos de 6.000 caracteres y líneas de ≤ 100 (salvo comandos).
- Git: rama `feat/<x>` o `fix/<x>` desde `main`, commits por pieza (Conventional Commits en
  español); tras verificar (tests + tipos + E2E), `git merge --no-ff` a `main` y borrar la rama.
  El push lo decide él.
