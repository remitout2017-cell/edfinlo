# syntax=docker/dockerfile:1

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps (curl only for container HEALTHCHECK + basic TLS certs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install Python deps first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
  && pip install --no-cache-dir gunicorn

# Copy the application code
COPY . .

# Create a non-root user and make sure temp folder is writable
# Your code uses Config.TEMP_DIR = "temp_sessions" [file:3]
RUN useradd -m -u 10001 appuser \
  && mkdir -p /app/temp_sessions \
  && chown -R appuser:appuser /app

USER appuser

# Your server is configured to run on port 8000 in uvicorn.run(...) [file:2]
EXPOSE 8000

# Container-level healthcheck hits your /health endpoint [file:2]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# Production command (NO reload)
# Binds to 0.0.0.0 so it’s reachable outside the container [file:2]
CMD ["sh", "-c", "gunicorn -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY:-2} -b 0.0.0.0:${PORT:-8000} --timeout ${GUNICORN_TIMEOUT:-180} agent_server:app"]
