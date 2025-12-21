# Loan Approval AI - Production Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Step 1: Clone and Setup
```bash
git clone <your-repo>
cd loan-approval-ai
```

### Step 2: Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your API key
nano .env
```

**Required in .env:**
```bash
GEMINI_API_KEY=your_actual_api_key_here
```

### Step 3: Deploy with Docker
```bash
# Build and start
docker-compose up -d

# Check logs
docker-compose logs -f

# Check health
curl http://localhost:8000/health
```

### Step 4: Test API
```bash
curl -X POST "http://localhost:8000/api/analyze" \
  -F "salary_slips_pdf=@test_salary.pdf" \
  -F "bank_statement_pdf=@test_bank.pdf" \
  -F "itr_pdf_1=@test_itr.pdf"
```

## 📚 API Documentation

### Endpoints

#### `GET /` - Root
Returns service status and version.

#### `GET /health` - Health Check
Detailed health status with configuration info.

#### `POST /api/analyze` - Main Analysis Endpoint

**Required Files:**
- `salary_slips_pdf` - 3 months of salary slips
- `bank_statement_pdf` - 6 months bank statement
- `itr_pdf_1` - Most recent ITR

**Optional Files:**
- `itr_pdf_2` - Previous year ITR
- `form16_pdf` - Form 16

**Response:**
```json
{
  "status": "success",
  "session_id": "20240101_120000_abc123",
  "processing_time_seconds": 85.3,
  "extracted_data": {
    "itr": {...},
    "bank_statement": {...},
    "salary_slips": {...}
  },
  "foir": {...},
  "cibil": {...},
  "quality": {...}
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | - | **Required** - Your Gemini API key |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Model for text processing |
| `GEMINI_VISION_MODEL` | `gemini-1.5-flash` | Model for document analysis |
| `MAX_FILE_SIZE_MB` | `50` | Maximum PDF file size |
| `MAX_PDF_PAGES` | `30` | Maximum pages to process |
| `API_PORT` | `8000` | API server port |
| `API_WORKERS` | `2` | Number of worker processes |
| `LOG_LEVEL` | `INFO` | Logging level |
| `ENVIRONMENT` | `production` | Environment name |

## 🐳 Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart service
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# Remove everything including volumes
docker-compose down -v
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:8000/health
```

### View Logs
```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service logs
docker-compose logs loan-approval-api
```

### Check Resource Usage
```bash
docker stats loan-approval-ai
```

## 🔒 Security Best Practices

1. **Never commit `.env` file** - Use `.env.example` as template
2. **Restrict API access** - Use firewall rules or reverse proxy
3. **Enable HTTPS** - Use nginx/traefik with SSL certificates
4. **Rotate API keys** - Regularly update Gemini API keys
5. **Monitor logs** - Set up log aggregation and alerts

## 🚨 Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs

# Verify .env file exists
ls -la .env

# Check port availability
netstat -tuln | grep 8000
```

### Out of memory
```bash
# Increase memory limit in docker-compose.yml
memory: 8G  # Increase from 4G
```

### API responding slowly
```bash
# Increase workers
API_WORKERS=4  # In .env file

# Check Gemini API limits
# Verify you haven't exceeded rate limits
```

### File upload fails
```bash
# Check file size
ls -lh your_file.pdf

# Increase limit in .env
MAX_FILE_SIZE_MB=100
```

## 📈 Production Deployment

### With Nginx Reverse Proxy

1. **Install Nginx**
```bash
sudo apt install nginx
```

2. **Configure Nginx** (`/etc/nginx/sites-available/loan-api`)
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
    }
}
```

3. **Enable and restart**
```bash
sudo ln -s /etc/nginx/sites-available/loan-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### With SSL (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## 🧪 Testing

### Manual Test
```bash
# Test with sample files
curl -X POST "http://localhost:8000/api/analyze" \
  -F "salary_slips_pdf=@testingdata/salaryslip.pdf" \
  -F "bank_statement_pdf=@testingdata/bankstatement.pdf" \
  -F "itr_pdf_1=@testingdata/itr1.pdf"
```

### Automated Testing
```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest tests/
```

## 📞 Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Review documentation: `/docs` endpoint (if DEBUG=true)
- Verify configuration: `/health` endpoint

## 📄 License

[Your License Here]