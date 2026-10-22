# Cómo trabajamos

Guía para Rodrigo y para cualquier sesión de Claude que trabaje en este repo.

## El ciclo de una tarea

1. **Elegir** una tarea de [hoja-de-ruta.md](hoja-de-ruta.md), o apuntar una idea nueva allí.
2. **Abrirla** con `/nueva-tarea <nombre>`: crea la rama (y un worktree si hay otra sesión).
3. **Diseñar antes de programar:** Claude explica qué va a hacer, en qué archivos y por qué.
   Para cambios grandes, usa el modo plan de Claude Code (Shift+Tab) y apruébalo antes.
4. **Construir por piezas:** cada pieza con sus tests y su commit.
5. **Cerrarla** con `/cerrar-tarea`: trae `main`, verifica, marca la tarea `[x]` y abre la PR.
   Cuando el CI está en verde, se fusiona la PR (lo dices tú o pulsas "Merge" en GitHub).
6. **Aprender:** `/explicame` sobre lo que no haya quedado claro.

## Varias sesiones a la vez

Cada sesión en su carpeta (worktree) y su rama. La carpeta principal `appFinanzas` se queda en
`main`, con tus datos reales y la app levantada.

```text
appFinanzas\            ← main, BD real, docker compose (puertos 8000/5173)
appFinanzas-<tarea>\    ← feat/<tarea>, BD vacía, solo tests y E2E
```

Reglas que evitan problemas:
- **Una rama, una tarea.** No empieces la siguiente encima de una sin fusionar ("ramas apiladas").
  Fusiona primero y crea la nueva desde `main`.
- **Fusionar pronto.** Cuanto más tiempo vive una rama separada, más conflictos tendrá.
- **Repartir zonas.** Dos sesiones a la vez en el mismo archivo = conflicto seguro. Mejor que una
  toque backend de una función y otra el estilo visual, por ejemplo.
- **Solo la carpeta principal levanta `docker compose`**: los puertos no se pueden compartir.
  Los worktrees verifican con `scripts/verificar.sh --e2e`, que usa contenedores propios.

### Fusionar: siempre por pull request

`main` está protegida en GitHub (Settings → Rules → "Proteger main"): no admite push directo ni
`--force`, y una PR solo se puede fusionar con el CI en verde y la rama al día con `main`.

```bash
# 1. En la rama: traer lo nuevo de main y resolver los conflictos ahí (sin romper main)
git fetch && git merge origin/main
scripts/verificar.sh --e2e
# 2. Subir la rama y abrir la PR (el CI de GitHub vuelve a comprobar)
git push -u origin feat/<tarea>
gh pr create --fill
# 3. Con el CI en verde: fusionar (o botón "Merge pull request" en GitHub)
gh pr merge --merge --delete-branch
# 4. En la carpeta principal: traer el resultado
git switch main && git pull --ff-only
```

**Lo que aprendimos el 22/10/2026:**
- **Una rama se fusiona por un solo camino.** La PR #1 se fusionó en GitHub mientras se fusionaba
  la misma rama en local: dos `main` con igual contenido y distinto historial, y el siguiente
  push habría sido rechazado. Con la regla de GitHub ya no puede pasar: solo existe el camino PR.
- **"Aceptar ambos" no es resolver un conflicto.** Pega las dos versiones una detrás de otra. Si
  las dos sesiones editaron la misma línea, queda duplicada: así CLAUDE.md acabó con la regla de
  divisas dos veces y por encima del límite. Hay que leer las dos versiones y escribir **una** que
  combine lo de ambas. En caso de duda: "resuelve el conflicto combinando a mano".

Comprobar que una rama ya está en `main`:
`git fetch && git merge-base --is-ancestor feat/<tarea> origin/main && echo "ya está en main"`.

## Usar a Claude de forma eficiente

- **Una sesión por tarea.** Al cambiar de tema, empieza una conversación nueva (`/clear`): el
  contexto viejo cuesta tokens y despista. CLAUDE.md, la hoja de ruta y la memoria se cargan
  igual, así que no se pierde lo importante.
- **Pide resultados, no pasos.** "Añade X de la hoja de ruta y verifícalo" funciona mejor que
  dictar archivo por archivo. Di qué te importa (rapidez, sencillez, aprender) y Claude decide.
- **Da material concreto:** rutas de archivos, capturas o un ejemplo del error. Los extractos
  bancarios, siempre fuera del repo y con los datos cambiados si es posible.
- **Usa las skills del proyecto** (en .claude/skills): `/nueva-tarea`, `/cerrar-tarea`,
  `/explicame`. Repiten bien los pasos que se olvidan.
- **Deja que verifique.** `scripts/verificar.sh --e2e` tarda unos 2 minutos y prueba linters, backend,
  tipos y la app en el navegador. Pide siempre "verificado" antes de fusionar.
- **Agentes para trabajo en paralelo dentro de una sesión:** auditorías o revisiones de solo
  lectura ("lanza agentes que revisen X, Y y Z"). Para construir funciones, mejor sesiones en
  worktrees que tú supervisas.

## Cómo te enseña Claude

- Antes de un cambio grande: el diseño en palabras sencillas, con las alternativas descartadas.
- Al cerrar cada pieza: 2-3 frases con el concepto nuevo que apareció (p. ej. "por qué un test
  debe fallar sin el arreglo", "qué es un worktree").
- Si algo no queda claro: `/explicame <tema o archivo>` da una explicación con ejemplos de tu
  propio código y, si quieres, un ejercicio pequeño para practicar.
