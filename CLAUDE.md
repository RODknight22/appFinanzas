# Personal Finance App

## Project Overview
App web local de finanzas personales, mantenible, legible y modular. El desarrollador (Rodrigo, mexicano
que vive en España: recibe dinero en MXN y gasta en EUR) aprende a programar supervisando el código.
Hablarle en español, explicar el diseño antes de cambios grandes y avanzar por piezas pequeñas.

## Tech Stack
- Backend: Python 3.12, FastAPI, SQLModel, Pydantic, Uvicorn. BD: SQLite en `data/finance.db` (volumen).
- Frontend: React 18 + Vite + TypeScript, Tailwind v4 (tokens + modo oscuro), Recharts, Lucide, @dnd-kit, Manrope.
- Docker Compose: servicios `backend` (:8000) y `frontend` (:5173, proxy `/api` → backend).

## Funcionalidades actuales
Transacciones (búsqueda sin tildes, filtros en URL, paginación), transferencias (comisión, pago de
tarjeta), metas de ahorro (cuenta vinculada o aportaciones), suscripciones, presupuestos, widgets,
cuentas (crédito/débito/rendimientos), categorías, multidivisa, login y personalización.

## Principios
- Código autodocumentado, modular y con tipado estricto; comentarios breves que expliquen el *por qué*.
- Errores HTTP semánticos (400, 401, 404, 409, 422, 429, 503) con mensajes legibles en español.
- Capas: Routers -> Services -> Models/Schemas | Pages -> Components -> api/.

## Convenciones del Backend (`backend/app/`)
- Español sin tildes ni ñ en identificadores (`mes_anio`, `/transacciones`). Routers sin lógica.
- Por entidad: `XBase` + tabla `X` en models.py; `XCreate`/`XRead`/`XUpdate` en schemas.py.
- Importes `Decimal` (12,2) siempre positivos: el signo lo da `tipo`. PATCH vía `cambios_parciales()`.
- Servicios lanzan `ErrorDeDominio` (services/errores.py); main.py → `{"detail": ...}`. Con dependencias: 409.
- Arranque (`init_db`): `create_all` + migraciones.py (solo añade columnas *nullable*/renombra valores)
  + datos_iniciales.py. Nunca borrar `finance.db`: los cambios de esquema deben ser aditivos.
- Cuentas: campos por tipo en `_normalizar_por_tipo`. Saldo de tarjeta negativo = deuda. Saldos solo vía
  `saldos.movimientos_por_cuenta` (transacciones + transferencias). Transferencias: no son ingreso/gasto;
  su comisión es una Transaccion con `transferencia_id` (solo se edita desde la transferencia).
- Metas: progreso en `metas._con_progreso` (saldo de cuenta o aportaciones); `fecha_cumplida` persiste.
- Divisas: tasas diarias por USD en `tasacambio` (manual > api); la API las expone en la moneda
  principal (`en_principal`). Toda transacción pasa por `completar_montos()` → `monto_cuenta` (saldo)
  y `monto_principal` (dashboard) con la tasa de su fecha. Sumar esos campos, nunca `monto`.
- Búsqueda: `_filtrar()` (services/transacciones.py), texto con `sin_acentos()` (database.py). Mes
  financiero: services/mes_financiero.py (`dia_inicio_mes`). Gráficas: `patrimonio`, `gastos_diarios`.
- Acceso: un usuario (scrypt) + cookie HttpOnly `sesion`; routers de datos con `requiere_sesion`
  en main.py. Tests: `client` simula sesión, `cliente_sin_sesion` no. Olvido: `python -m app.restablecer_contrasena`.

## Convenciones del Frontend (`frontend/src/`)
- `api/cliente.ts` es el único que usa `fetch`. `types/` refleja schemas.py (importes = `string`).
- Páginas: `useDatos` + `<Contenido>`; formularios: `useEnvio` + `PieFormulario`; modales con estado
  único (`null | "nueva" | entidad`) y `key` para reiniciar. Inputs con `CLASE_ENTRADA(_BASE)`.
- `useConfiguracion()` da config, tasas y `convertir`; formatear con `formatearDinero(valor, moneda)`.
- Colores: nunca grises fijos (slate/white); tokens de index.css (`bg-superficie`, `text-tenue`,
  `border-linea`…) que cada estilo define (fintech por defecto, oscuro primero). Acento: `*-acento-*`.
- Widgets en dashboard/registroWidgets.tsx (pintan con `DatosPanel`; tamaños S/M/L/XL = 1-4 columnas).

## Hoja de ruta
- [ ] Siguiente: importar CSV/Excel + reglas de categorización, ingresos recurrentes, copias de
  seguridad/exportar. Mejoras: importes como céntimos enteros, E2E Playwright en el repo + CI,
  notificaciones en vez de alert/confirm, quitar CORS sin uso, dar sentido o quitar tipos
  ahorro/inversión, Alembic si hay cambios no aditivos. Ideas: PDF con IA, Open Banking (PSD2).

## Comandos
- `docker compose up --build` / `docker compose down` (conserva la BD).
- Si cambia package.json: `docker compose up -d --build -V frontend` (-V renueva node_modules).
- Tests (Git Bash, raíz): `MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/backend:/app" -w /app appfinanzas-backend sh -c "pip install -q -r requirements-dev.txt && pytest -q"`
- Tipos (sin Node local): `MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/frontend:/app" -w /app node:22-alpine npx tsc --noEmit`
- Verificación visual: Playwright (`mcr.microsoft.com/playwright:v1.49.1-noble`) contra contenedores
  temporales `fin-test-backend`/`fin-test-frontend` en la red `appfinanzas_default` con
  `DATA_DIR=/tmp/data`: nunca probar sobre los datos reales. Borrarlos al terminar.

## Reglas
- Mantener este documento actualizado y con menos de 70 líneas.
- Git: rama `feat/<x>` o `fix/<x>` desde `main`, commits por pieza (Conventional Commits en español);
  tras verificar (tests + tipos + E2E), `git merge --no-ff` a `main` y borrar la rama. Push: lo decide él.
