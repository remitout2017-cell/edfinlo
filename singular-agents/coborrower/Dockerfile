FROM python:3.10-slim

WORKDIR /app

# Install system dependencies including poppler for image conversion
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    poppler-utils \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY coborrower_requirements.txt .
RUN pip install --no-cache-dir -r coborrower_requirements.txt

# Copy application code
COPY . .

# Create upload directory
RUN mkdir -p coborrower_uploads

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV FLASK_ENV=production
ENV USE_IMAGES=true

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/api/health || exit 1

# Run with Gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5001", \
     "--workers", "4", \
     "--threads", "4", \
     "--timeout", "300", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "coborrower_app:app"]