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
- **Manejo de errores limpio**: Respuestas HTTP semánticas (`400`, `404`, `422`, `500`) con mensajes legibles.
- **Separación de responsabilidades**: 
  - Backend: Routers -> Services / CRUD -> Models / Schemas.
  - Frontend: Pages -> Components -> API services (`fetch`/`axios`).

## Development & Run Commands
- `docker compose up --build`: Levanta la aplicación completa.
- `docker compose down`: Apaga los contenedores conservando el volumen de SQLite.
- Backend API Docs: accesible localmente en `http://localhost:8000/docs`.
- Frontend Web UI: accesible localmente en `http://localhost:5173`.

## Reglas
Necesito que vayas actualizando este documento y que tenga menos de 70 lineas para que tu puedas ir evolucionando con el pryecto. Aqui puedes modificar todo lo que tu creas conveniente para poder crear mi app

Tambien usa git para poder guardar todos los cambios y lo que me importa es tener un buen historial de commits cuando se completa algo