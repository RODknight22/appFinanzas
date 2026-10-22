---
name: nueva-tarea
description: Empezar una tarea de appFinanzas en su propia rama (y worktree si hay otra sesión de Claude trabajando en paralelo). Usar cuando Rodrigo pide empezar una función, arreglo o tarea de la hoja de ruta, o escribe /nueva-tarea.
argument-hint: "<nombre-corto> [descripción]"
---

# Nueva tarea

Objetivo: que la tarea empiece desde el `main` más reciente, aislada de otras sesiones.

1. **Situación actual** (no lo des por supuesto):
   - `git worktree list` y `git branch --list`: ¿hay otros worktrees o ramas sin fusionar?
   - `git log --oneline -5 main` y `git status --short` en la carpeta principal.
   - Si hay una rama de otra tarea **sin fusionar** que toque lo mismo, avisa a Rodrigo: lo
     correcto es fusionarla antes (no apilar ramas).
2. **Nombre:** `feat/<nombre>` para funciones, `fix/<nombre>` para arreglos (minúsculas, guiones).
3. **¿Worktree o rama en la carpeta actual?**
   - Si Rodrigo trabaja con otra sesión a la vez (o lo pide): worktree hermano.
     `git worktree add ../appFinanzas-<nombre> -b feat/<nombre> main`
     y dile que abra esa carpeta en otra ventana de VS Code (o que siga allí esta sesión).
   - Si no: `git switch main && git switch -c feat/<nombre>`.
   - Un worktree no levanta `docker compose`: se verifica con `scripts/verificar.sh --e2e`.
4. **Contexto:** busca la tarea en docs/hoja-de-ruta.md (por qué, dónde, cuándo está hecha) y
   lee el CLAUDE.md de la parte que vayas a tocar (backend/ o frontend/).
5. **Antes de programar:** explica a Rodrigo el diseño en pocas líneas (qué, archivos, por qué,
   alternativas descartadas). Si la tarea es ambigua, pregunta con opciones concretas.
