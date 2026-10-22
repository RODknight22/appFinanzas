---
name: cerrar-tarea
description: Terminar una tarea de appFinanzas - traer origin/main a la rama, resolver conflictos combinando a mano, verificar (tests, tipos, E2E), marcar la hoja de ruta, subir la rama y abrir la pull request; fusionarla cuando Rodrigo lo diga. Usar cuando Rodrigo dice que algo está listo o escribe /cerrar-tarea.
argument-hint: "[rama]"
---

# Cerrar tarea

`main` está protegida en GitHub: solo entra por pull request, con el CI (`backend`, `frontend`)
en verde y la rama al día con `main`. Nunca intentes `git push` a `main` ni `--force`.

1. **Todo guardado:** `git status --short` en la rama. Si hay cambios, haz commit por pieza.
2. **Traer main a la rama:** `git fetch && git merge origin/main`.
   - Si hay conflictos, **combínalos a mano**: lee las dos versiones y escribe una que conserve
     lo de ambas sin repetir líneas. Nunca "aceptar ambos" a ciegas (duplica reglas, sobre todo
     en CLAUDE.md y docs/). Revisa después: `git grep -nE '^(<<<<<<<|=======|>>>>>>>)'` vacío.
   - Los CLAUDE.md deben seguir dentro de su límite de tamaño (lo dice cada uno al final).
3. **Verificar:** `scripts/verificar.sh --e2e`. Si falla, arregla en la rama y repite. Si la
   tarea tiene pantalla nueva, mira también las capturas de e2e/capturas/.
4. **Hoja de ruta:** marca la tarea con `[x]` en docs/hoja-de-ruta.md, commit `docs: …`.
5. **Pull request:**
   - `git push -u origin <rama>`
   - `gh pr create --base main --title "<tipo>(<ámbito>): <resumen>" --body "<cuerpo>"`. Cuerpo:
     qué cambia y por qué, cómo se verificó (números reales) y riesgos; termina con la línea de
     atribución que indique la sesión.
   - `gh pr checks --watch` hasta que el CI termine. Si falla, arregla, push y espera de nuevo.
6. **Fusionar:** solo cuando Rodrigo lo diga (o lo hace él con el botón de GitHub):
   `gh pr merge --merge --delete-branch`. Si GitHub dice que la rama no está al día, repite el
   paso 2, push y espera el CI.
7. **Después de fusionar:**
   - Carpeta principal: `git switch main && git pull --ff-only` (docker compose recarga solo).
   - `git branch -d <rama>`. Si era un worktree, recuerda a Rodrigo cerrar esa ventana y luego
     `git worktree remove ../appFinanzas-<nombre>` (no lo borres con la sesión abierta).
8. **Resumen para Rodrigo:** enlace de la PR, resultado de la verificación y en 2-3 frases el
   concepto nuevo que conviene que aprenda de esta tarea.
