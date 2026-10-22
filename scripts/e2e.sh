#!/usr/bin/env bash
# Pruebas de punta a punta (E2E): la app real en el navegador, con una BD temporal.
#
# Uso (Git Bash): scripts/e2e.sh [prueba]   p. ej. scripts/e2e.sh importar
#
# Levanta un backend y un frontend de usar y tirar en su propia red de Docker y
# ejecuta cada e2e/*.mjs con Playwright. Cada prueba empieza con una BD vacía.
# Nunca toca data/finance.db ni los puertos 8000/5173 de `docker compose`.
# Las capturas quedan en e2e/capturas/ (no se suben a git).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
source scripts/comun.sh

# Nombres propios de esta carpeta: dos worktrees pueden ejecutar pruebas a la vez.
SUFIJO="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9\n' '-')"
RED="fin-e2e-$SUFIJO"
BACKEND="fin-e2e-backend-$SUFIJO"
FRONTEND="fin-e2e-frontend-$SUFIJO"
VOLUMEN_PLAYWRIGHT="appfinanzas_playwright"

limpiar() {
  docker rm -f "$BACKEND" "$FRONTEND" >/dev/null 2>&1 || true
  docker network rm "$RED" >/dev/null 2>&1 || true
}
trap limpiar EXIT
limpiar
docker network create "$RED" >/dev/null
mkdir -p e2e/capturas

esperar() {  # esperar <contenedor> <comando de comprobación>
  for _ in $(seq 60); do
    docker exec "$1" sh -c "$2" >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "✘ $1 no arrancó a tiempo"; docker logs --tail 30 "$1"; return 1
}

arrancar_backend() {  # uno nuevo para cada prueba: BD vacía
  docker rm -f "$BACKEND" >/dev/null 2>&1 || true
  docker run -d --name "$BACKEND" --network "$RED" -e DATA_DIR=/tmp/data -e TASAS_AUTOMATICAS=false \
    -v "$PWD/backend/app:/app/app:ro" "$IMAGEN_BACKEND" >/dev/null
  esperar "$BACKEND" "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')\""
}

paso "E2E: preparando la app de prueba"
asegurar_imagen_backend
docker run -d --name "$FRONTEND" --network "$RED" -e API_URL="http://$BACKEND:8000" \
  -v "$PWD/frontend:/app" -v "$VOLUMEN_NODE:/app/node_modules" -w /app "$IMAGEN_NODE" \
  sh -c "$INSTALAR_NODE && npx vite --host 0.0.0.0 --port 5173" >/dev/null

PRUEBAS=(e2e/${1:-*}.mjs)
fallos=0
for prueba in "${PRUEBAS[@]}"; do
  nombre="$(basename "$prueba" .mjs)"
  [[ "$nombre" == comun ]] && continue
  arrancar_backend
  esperar "$FRONTEND" "wget -qO- http://127.0.0.1:5173 >/dev/null"
  paso "E2E: $nombre"
  # En la red del frontend y por localhost: Vite rechaza otros nombres de host.
  if ! docker run --rm --network "container:$FRONTEND" \
      -v "$PWD/e2e:/e2e:ro" -v "$PWD/e2e/capturas:/capturas" \
      -v "$PWD/frontend/src/App.tsx:/rutas/App.tsx:ro" -v "$VOLUMEN_PLAYWRIGHT:/pw" \
      -e BASE=http://localhost:5173 "$IMAGEN_PLAYWRIGHT" \
      sh -c "cd /pw && { [ -d node_modules/playwright ] || npm i -s --no-audit --no-fund playwright@1.49.1 >/dev/null; } \
             && cp /e2e/*.mjs . && node $nombre.mjs"; then
    fallos=$((fallos + 1))
  fi
done

if (( fallos > 0 )); then
  echo "✘ $fallos prueba(s) E2E fallaron (capturas en e2e/capturas/)"; exit 1
fi
