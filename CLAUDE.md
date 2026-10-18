# Personal Finance App

## Project Overview
Aplicación web local de finanzas personales diseñada para ser mantenible, legible y modular.
El objetivo del desarrollador es aprender a programar mientras supervisa la construcción del código.

## Tech Stack & Architecture
- **Backend**: Python 3.11+, FastAPI, SQLModel/SQLAlchemy, Pydantic, Uvicorn.
- **Database**: SQLite (almacenada localmente en `/data/finance.db`).
- **Frontend**: React 18+ (Vite), Tailwind CSS (estilo moderno con soporte Dark Mode), Recharts para dashboards, Lucide React para iconos.
- **Containerization**: Docker & Docker Compose (servicios: `backend`, `frontend`, con volumen persistente para la BD).

## Core Features (MVP - Phase 1)
1. **Transacciones**: Registro manual de ingresos y gastos categorizados (fecha, monto, categoría, notas, tipo de cuenta).
2. **Suscripciones y Gastos Recurrentes**: Lista de pagos periódicos con periodicidad, recordatorio de fecha de cobro y monto estimado.
3. **Presupuestos**: Límite mensual por categoría con barra de progreso y cálculo de consumo actual.
4. **Dashboard**: Balance global, métricas de flujo neto mensual, gráfico de barras (ingresos vs. gastos) y gráfico de pastel/anillo (gastos por categoría).

## Coding Principles & Developer Mentorship
- **Legibilidad ante todo**: Escribe código autodocumentado, modular y con tipado estricto (Type hints en Python, TypeScript o JSDoc claro en React).
- **Comentarios explicativos**: Agrega comentarios breves que expliquen el *por qué* de las funciones clave para facilitar el aprendizaje del usuario al leer los archivos.
- **Manejo de errores limpio**: Respuestas HTTP semánticas (`400`, `404`, `409`, `422`, `500`) con mensajes legibles.
- **Separación de responsabilidades**:
  - Backend: Routers -> Services / CRUD -> Models / Schemas.
  - Frontend: Pages -> Components -> API services (`fetch`/`axios`).

## Convenciones del Backend (`backend/app/`)
- Código y API en español, sin tildes ni ñ en identificadores (`mes_anio`, `/transacciones`).
- Por entidad: `XBase` + tabla `X` en models.py; `XCreate`/`XRead`/`XUpdate` en schemas.py.
- Importes con `Decimal` (12 dígitos, 2 decimales), siempre positivos: el signo lo da `tipo`.
- Los servicios lanzan `ErrorDeDominio` (services/errores.py): 400 regla, 404 no existe, 409 conflicto;
  main.py los traduce a `{"detail": "..."}`. Los routers no contienen lógica.
- PATCH parcial vía `cambios_parciales()`; no se borran registros con dependencias (409).
- Arranque (`init_db`): `create_all` + migraciones.py (solo añade columnas *nullable* y renombra
  valores) + datos_iniciales.py (config y categorías si la BD está vacía). Nunca borrar `finance.db`.
- Cuentas: campos por tipo (crédito: dia_corte/dia_pago/limite; rendimientos: tasa anual) que
  `_normalizar_por_tipo` exige o anula. Saldo de tarjeta negativo = deuda.

## Convenciones del Frontend (`frontend/src/`, TypeScript estricto)
- `api/cliente.ts` es el único que usa `fetch` (ruta `/api`, proxy de Vite al backend).
- `types/` refleja schemas.py: si cambia un schema, actualizar su tipo. Importes = `string`.
- Páginas cargan con `useDatos` + `<Contenido>`; formularios usan `useEnvio` + `PieFormulario`.
- Modales con estado único (`null | "nueva" | entidad`); `key` reinicia el formulario.
- Inputs con `CLASE_ENTRADA` (o `CLASE_ENTRADA_BASE` + ancho).
- Moneda global (backend `/configuracion`) vía `ConfiguracionProvider`; formatear siempre con
  `formatearDinero`/`formatearFecha` de utils/formato.ts (usan la moneda y locale activos).

## Estado del Proyecto
- [x] Paso 1: modelos, SQLite persistente, CRUD base, Docker del backend.
- [x] Paso 2: suscripciones (+ registrar-pago), endpoints `/dashboard/*`, tests con pytest.
- [x] Paso 3: frontend completo (dashboard, transacciones, presupuestos, suscripciones,
  cuentas, categorías), modo oscuro y móvil; verificado con Playwright.
- [x] Paso 4: monedas (MXN/USD/EUR/GTQ/HNL), categorías por defecto y creación rápida,
  tarjetas de crédito (corte/pago), débito y cuentas con rendimientos diarios.
- [ ] Ideas: transferencias entre cuentas (p. ej. pagar la tarjeta desde débito), Alembic.

## Development & Run Commands
- `docker compose up --build`: Levanta la aplicación completa.
- `docker compose down`: Apaga los contenedores conservando el volumen de SQLite.
- Sin Docker: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`.
- Tests (BD en memoria, no tocan datos reales), desde la raíz del repo en Git Bash:
  `MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/backend:/app" -w /app appfinanzas-backend sh -c "pip install -q -r requirements-dev.txt && pytest -q"`
- Comprobar tipos del frontend (no hay Node local):
  `MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/frontend:/app" -w /app node:22-alpine npx tsc --noEmit`
- App web: `http://localhost:5173` · Docs de la API: `http://localhost:8000/docs`.

## Reglas
- Mantener este documento actualizado y con menos de 70 líneas.
- Usar git: un commit descriptivo (Conventional Commits, en español) por cada pieza completada.
