# appFinanzas

App web local de finanzas personales, multidivisa de verdad (cada movimiento guarda su valor en la
moneda de la cuenta y en la principal con la tasa de su fecha). El dueño, Rodrigo (mexicano en
España: cobra en MXN y gasta en EUR), aprende a programar supervisando el código.

## Cómo trabajar con Rodrigo
- Hablarle en español, claro y sin jerga innecesaria; explicar el diseño antes de cambios grandes
  (qué problema, qué archivos, alternativas descartadas) y avanzar por piezas.
- Al cerrar cada pieza, contarle en 2-3 frases qué concepto nuevo apareció y por qué se hizo así.
  Si pregunta, profundizar con ejemplos de su propio código (skill `/explicame`).
- Ser honesto: si algo no se verificó, decirlo; si una idea suya no conviene, explicar por qué.

## Mapa
- backend/: FastAPI + SQLModel + SQLite → reglas en backend/CLAUDE.md.
- frontend/: React + Vite + TS + Tailwind v4 → reglas en frontend/CLAUDE.md.
- docs/hoja-de-ruta.md: versiones y tareas. Marcar `[x]` al fusionar cada una.
- docs/como-trabajamos.md: flujo con sesiones en paralelo, git y verificación.
- Producción: backend/app/servidor.py (API en /api + web, `ProteccionLocal`), lanzador.py
  (ejecutable PyInstaller, empaquetado/), Dockerfile raíz. Release: tag `v*` → .github/workflows.
  Versión en backend/app/version.py + frontend/package.json; cambios en CHANGELOG.md.

## Reglas de oro
- Nunca leer, probar ni escribir sobre data/finance.db (datos reales): siempre BD temporal.
- Esquema solo aditivo (columnas *nullable*); dinero en `Decimal`, nunca `float`.
- Medir antes de optimizar; no añadir dependencias sin justificarlas y fijar su versión.
- Código autodocumentado y tipado; comentarios breves que expliquen el *por qué*.

## Git y sesiones en paralelo
- Al empezar: `git worktree list` y `git log --oneline -5 main`: otra sesión puede haber fusionado.
- Cada tarea en su rama `feat/<x>` o `fix/<x>` desde `main` actualizado; si hay otra sesión,
  en su propio worktree (`/nueva-tarea`). Commits por pieza (Conventional Commits en español).
- Cerrar con `/cerrar-tarea`: traer `main` a la rama, resolver conflictos combinando a mano
  (nunca "aceptar ambos" a ciegas: duplica líneas), `scripts/verificar.sh --e2e`,
  `git merge --no-ff` a `main` y borrar la rama. Una rama por vez: no apilar ramas sin fusionar.
- Solo la carpeta principal levanta `docker compose` (puertos 8000/5173). El push lo decide él.

## Comandos (Git Bash, raíz del repo o de un worktree)
- App: `docker compose up -d` / `docker compose down` (la BD se conserva).
- Verificar: `scripts/verificar.sh` (tests + tipos), `--e2e` añade Playwright con BD temporal.

## Este documento
Menos de 4.000 caracteres y líneas ≤ 100. El detalle va en backend/, frontend/ o docs/.
