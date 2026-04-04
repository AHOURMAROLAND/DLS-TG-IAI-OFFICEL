FROM python:3.11-slim

WORKDIR /app

# Dépendances système (gcc pour bcrypt, libpq pour asyncpg/psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code source
COPY . .

# Créer le dossier logs
RUN mkdir -p logs

EXPOSE 8000

# Migrations puis démarrage — $PORT est fourni par Render
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
