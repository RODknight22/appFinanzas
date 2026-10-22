#!/usr/bin/env bash
# Comprueba que todo está bien antes de fusionar: linters, tests del backend y tipos del frontend.
# Es lo mismo que comprueba el CI de GitHub (.github/workflows/ci.yml).
#
# Uso (Git Bash, desde la raíz del repo o de cualquier worktree):
#   scripts/verificar.sh          linters + tests + tipos
#   scripts/verificar.sh --e2e    además recorre la app con Playwright (scripts/e2e.sh)
#
# Todo corre en contenedores desechables: no hace falta tener Python ni Node instalados,
# y nunca toca data/finance.db.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
source scripts/comun.sh

paso "Backend: linter y tests"
asegurar_imagen_backend
docker run --rm -v "$PWD/backend:/app" -w /app "$IMAGEN_BACKEND" \
  sh -c "pip install -q --disable-pip-version-check -r requirements-dev.txt >/dev/null && ruff check . && pytest -q -p no:warnings"

paso "Tipos del frontend"
docker run --rm -v "$PWD/frontend:/app" -v "$VOLUMEN_NODE:/app/node_modules" -w /app "$IMAGEN_NODE" \
  sh -c "$INSTALAR_NODE && npx tsc --noEmit"

if [[ "${1:-}" == "--e2e" ]]; then
  scripts/e2e.sh
fi

paso "Todo en orden ✔"
