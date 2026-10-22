# Piezas compartidas por los scripts de verificación (se cargan con `source`).

# Git Bash convierte rutas como /app en C:/Program Files/Git/app: esto lo evita.
export MSYS_NO_PATHCONV=1

IMAGEN_BACKEND="appfinanzas-backend"
IMAGEN_NODE="node:22-alpine"
IMAGEN_PLAYWRIGHT="mcr.microsoft.com/playwright:v1.49.1-noble"
# node_modules vive en un volumen de Docker que se reutiliza entre ejecuciones (y worktrees):
# solo se reinstala si package-lock.json cambió desde la última vez.
VOLUMEN_NODE="appfinanzas_node_modules"
INSTALAR_NODE='cmp -s package-lock.json node_modules/.lock-instalado || { npm ci --no-audit --no-fund --loglevel=error && cp package-lock.json node_modules/.lock-instalado; }'

paso() {
  printf '\n\033[1;36m▶ %s\033[0m\n' "$1"
}

# La imagen la crea `docker compose build`; si aún no existe (p. ej. en un ordenador nuevo), se construye.
asegurar_imagen_backend() {
  docker image inspect "$IMAGEN_BACKEND" >/dev/null 2>&1 || docker build -q -t "$IMAGEN_BACKEND" backend >/dev/null
}
