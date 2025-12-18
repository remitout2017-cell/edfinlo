FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for image processing
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    poppler-utils \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libjpeg-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY work_experience_requirements.txt .
RUN pip install --no-cache-dir -r work_experience_requirements.txt

# Copy application code
COPY work_experience.py .
COPY work_experience_app.py .

# Create directories
RUN mkdir -p work_experience_uploads

# Set environment
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV FLASK_ENV=production
ENV USE_IMAGE_EXTRACTION=true

# Expose port
EXPOSE 5002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5002/api/health || exit 1

# Run with Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5002", \
     "--workers", "4", \
     "--threads", "8", \
     "--timeout", "300", \
     "--worker-class", "gevent", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "work_experience_app:app"]