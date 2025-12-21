# Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for PDF processing
RUN apt-get update && apt-get install -y \
    libmagic1 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Create directories for uploads and logs
RUN mkdir -p /app/academic_uploads /app/logs

# Expose port 5002
EXPOSE 5002

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=5002
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5002/api/health')" || exit 1

# Run the Flask app
CMD ["python", "app.py"]
