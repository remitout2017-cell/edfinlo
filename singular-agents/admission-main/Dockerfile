# ---- base runtime image ----
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps commonly needed by opencv-python + image stack in slim images
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 10001 appuser

# Install python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

# Copy app code
COPY . /app

# Ensure temp session dir exists (your code uses temp_admission_sessions) 
RUN mkdir -p /app/temp_admission_sessions && chown -R appuser:appuser /app

USER appuser

EXPOSE 7000

# Production server (no reload)
# Tune WEB_CONCURRENCY based on CPU (e.g., 2-4 on small VMs)
ENV WEB_CONCURRENCY=2 \
    PORT=7000

CMD ["sh", "-c", "gunicorn -k uvicorn.workers.UvicornWorker agent_server:app --bind 0.0.0.0:${PORT} --workers ${WEB_CONCURRENCY} --timeout 180"]
