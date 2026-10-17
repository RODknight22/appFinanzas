# Imagen ligera de Python; "slim" evita cientos de MB de herramientas innecesarias.
FROM python:3.12-slim

# No generar .pyc y mostrar los logs al instante (sin buffer).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/data

WORKDIR /app

# Copiamos primero solo requirements.txt: si no cambia, Docker reutiliza la capa
# con las dependencias ya instaladas y los rebuilds son mucho más rápidos.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
