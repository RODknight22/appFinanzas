# Imagen de PRODUCCIÓN (la que se publica). La de desarrollo está en backend/ y frontend/.
#
# Dos etapas: la primera compila la web con Node; la segunda solo lleva Python y
# el resultado compilado. Node no llega a la imagen final: pesa mucho menos.

# --- 1. Compilar la web -------------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- 2. Servidor ---------------------------------------------------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_MODO=produccion \
    SQLITE_WAL=true \
    DATA_DIR=/data \
    FRONTEND_DIR=/app/web     TZ=Europe/Madrid
# La app usa la fecha local ("hoy", el mes actual, los avisos de las 21 h). Sin zona horaria el
# contenedor vive en UTC y de 00:00 a 02:00 en España "hoy" sería ayer. Otra zona:
# `docker run -e TZ=America/Mexico_City ...`.
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt backend/constraints.txt ./
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt -c constraints.txt
COPY backend/app ./app
COPY --from=web /web/dist ./web

# Sin root: si alguien encontrara un fallo en la app, no tendría permisos de
# administrador dentro del contenedor.
RUN useradd --create-home --uid 1000 finanzas && mkdir -p /data && chown finanzas /data
USER finanzas
VOLUME ["/data"]
EXPOSE 8000

# Docker marca el contenedor como "unhealthy" si la app deja de responder.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)"

# 0.0.0.0 DENTRO del contenedor es necesario para que Docker le pase el tráfico;
# quién puede conectarse lo decide el `-p 127.0.0.1:8000:8000` al arrancarlo.
# Sin registro de accesos, como el ejecutable: las rutas llevan lo que buscas y no deben
# quedarse en `docker logs`.
CMD ["uvicorn", "app.servidor:crear_aplicacion", "--factory", "--host", "0.0.0.0", "--port", "8000", \
     "--no-access-log"]
