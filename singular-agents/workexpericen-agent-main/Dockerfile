FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for opencv / PyMuPDF / Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libjpeg-dev \
    zlib1g-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd -m -u 10001 appuser

# Install Python deps
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

# Copy code
COPY . /app

# Ensure temp dirs exist and are writable
RUN mkdir -p /app/temp_uploads /app/temp_sessions && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 7005

ENV PORT=7005

# Use Flask’s built-in server; for heavier prod, swap to gunicorn
CMD ["sh", "-c", "python app.py"]
