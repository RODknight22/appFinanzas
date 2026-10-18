# Personal Finance App

## Project Overview
Aplicación web local de finanzas personales diseñada para ser mantenible, legible y modular.
El objetivo del desarrollador es aprender a programar mientras supervisa la construcción del código.

## Tech Stack & Architecture
- **Backend**: Python 3.11+, FastAPI, SQLModel/SQLAlchemy, Pydantic, Uvicorn.
- **Database**: SQLite (almacenada localmente en `/data/finance.db`).
- **Frontend**: React 18+ (Vite), Tailwind CSS (estilo moderno con soporte Dark Mode), Recharts para dashboards, Lucide React para iconos.
- **Containerization**: Docker & Docker Compose (servicios: `backend`, `frontend`, con volumen persistente para la BD).

## Funcionalidades
Transacciones, suscripciones, presupuestos, dashboard de widgets, cuentas (crédito/débito/rendimientos),
categorías, multidivisa con tasas históricas, login y personalización (acento, perfil, mes financiero).

## Coding Principles & Developer Mentorship
- **Legibilidad ante todo**: Escribe código autodocumentado, modular y con tipado estricto (Type hints en Python, TypeScript o JSDoc claro en React).
- **Comentarios explicativos**: Agrega comentarios breves que expliquen el *por qué* de las funciones clave para facilitar el aprendizaje del usuario al leer los archivos.
- **Manejo de errores limpio**: Respuestas HTTP semánticas (`400`, `401`, `404`, `409`, `422`, `429`, `503`) con mensajes legibles.
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
- Divisas (services/divisas.py): tasas diarias por USD en `tasacambio` (manual > api). Toda
  transacción nueva pasa por `completar_montos()`: `monto_cuenta` (saldo) y `monto_principal`
  (dashboard) con la tasa de su fecha. Sumar siempre esos campos, nunca `monto`.
- Acceso: un usuario (scrypt) + sesión en cookie HttpOnly `sesion`. Routers de datos se registran
  en main.py con `requiere_sesion`; solo `/auth/*` y `/health` son públicos. Tests: fixture
  `client` simula sesión, `cliente_sin_sesion` no. Olvido: `python -m app.restablecer_contrasena`.

## Convenciones del Frontend (`frontend/src/`, TypeScript estricto)
- `api/cliente.ts` es el único que usa `fetch` (ruta `/api`, proxy de Vite al backend).
- `types/` refleja schemas.py: si cambia un schema, actualizar su tipo. Importes = `string`.
- Páginas cargan con `useDatos` + `<Contenido>`; formularios usan `useEnvio` + `PieFormulario`.
- Modales con estado único (`null | "nueva" | entidad`); `key` reinicia el formulario.
- Inputs con `CLASE_ENTRADA` (o `CLASE_ENTRADA_BASE` + ancho).
- Configuración y tasas vía `useConfiguracion()`; formatear con `formatearDinero(valor, moneda)`
  (todas las monedas en la región de la principal: "$" solo para ella, código para el resto).
- Color de la app: clases `*-acento-*` (variables CSS en index.css). emerald/rose solo para
  ingreso/gasto o éxito/error. Mes financiero: `mesActual()`/`rangoDelMes()` (día de inicio).
- Widgets: añadirlos en dashboard/registroWidgets.tsx; pintan con `DatosPanel` (no piden datos).

## Estado del Proyecto
- [x] Pasos 1-4 y Fases 1-3: CRUD, dashboard, tipos de cuenta, multidivisa, login, widgets
  reordenables y personalización. Ideas: transferencias entre cuentas, exportar CSV, Alembic.

## Development & Run Commands
- `docker compose up --build`: Levanta la aplicación completa.
- `docker compose down`: Apaga los contenedores conservando el volumen de SQLite.
- Si cambia package.json: `docker compose up -d --build -V frontend` (-V renueva node_modules).
- Tests (BD en memoria; Git Bash, raíz del repo): `MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/backend:/app" -w /app appfinanzas-backend sh -c "pip install -q -r requirements-dev.txt && pytest -q"`
- Tipos del frontend (no hay Node local): `MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/frontend:/app" -w /app node:22-alpine npx tsc --noEmit`
- App web: `http://localhost:5173` · Docs de la API: `http://localhost:8000/docs`.

## Reglas
- Mantener este documento actualizado y con menos de 70 líneas.
- Usar git: un commit descriptivo (Conventional Commits, en español) por cada pieza completada.
