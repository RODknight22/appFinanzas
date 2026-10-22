---
name: cerrar-tarea
description: Terminar una tarea de appFinanzas - traer main a la rama, resolver conflictos combinando a mano, verificar (tests, tipos, E2E), fusionar con --no-ff en main, marcar la hoja de ruta y limpiar. Usar cuando Rodrigo dice que algo está listo para fusionar o escribe /cerrar-tarea.
argument-hint: "[rama]"
---

# Cerrar tarea

Fusionar son dos pasos: primero `main` → rama (donde se arreglan los choques sin romper `main`),
después rama → `main`. Ejecuta los dos y verifica entre medias.

1. **Todo guardado:** `git status --short` en la rama. Si hay cambios, haz commit por pieza.
2. **Traer main a la rama:** `git merge main`.
   - Si hay conflictos, **combínalos a mano**: lee las dos versiones y escribe una que conserve
     lo de ambas sin repetir líneas. Nunca "aceptar ambos" a ciegas (duplica reglas, sobre todo
     en CLAUDE.md y docs/). Revisa después: `git grep -nE '^(<<<<<<<|=======|>>>>>>>)'` vacío.
   - Los CLAUDE.md deben seguir dentro de su límite de tamaño (lo dice cada uno al final).
3. **Verificar:** `scripts/verificar.sh --e2e`. Si falla, arregla en la rama y repite. Si la
   tarea tiene pantalla nueva, mira también las capturas de e2e/capturas/.
4. **Hoja de ruta:** marca la tarea con `[x]` en docs/hoja-de-ruta.md (o añádela a "Hecho"),
   commit `docs: …`.
5. **Fusionar en main** desde la carpeta principal (en un worktree no se puede cambiar a main):
   `git -C <carpeta principal> merge --no-ff <rama> -m "Merge <rama>: <resumen>"`.
   Comprueba: `git merge-base --is-ancestor <rama> main`.
6. **Limpiar:** `git branch -d <rama>`. Si era un worktree, recuerda a Rodrigo cerrar esa
   ventana y luego `git worktree remove ../appFinanzas-<nombre>` (no lo borres con la sesión
   abierta). El push lo decide él: díselo, no lo hagas.
7. **Resumen para Rodrigo:** qué se fusionó, resultado de la verificación (números reales) y en
   2-3 frases el concepto nuevo que conviene que aprenda de esta tarea.
