FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System dependencies for opencv + PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libjpeg-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd -m -u 10001 appuser

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

# Copy application
COPY . /app

# Create temp directories
RUN mkdir -p /app/temp_uploads /app/temp_test_scores && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 7006

ENV PORT=7006

CMD ["python", "app.py"]
