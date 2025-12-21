# Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for PDF and image processing
RUN apt-get update && apt-get install -y \
  libgl1 \
  libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

# Copy requirements first (better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY . .

# Create temp sessions directory
RUN mkdir -p /app/temp_sessions

# Expose port 8500
EXPOSE 8500

# Set environment variables
ENV PORT=8500
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8500/health')" || exit 1

# Run with uvicorn on port 8500
CMD ["uvicorn", "agent_server:app", "--host", "0.0.0.0", "--port", "8500", "--workers", "2"]
