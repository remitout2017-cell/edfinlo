# Academic Records Extraction API with Gap Detection

A production-ready REST API for extracting and analyzing academic records with education gap detection.

## Features

- 📄 Extract data from 10th, 12th, graduation PDFs, and certificates
- 🔍 AI-powered extraction using Gemini and Groq models
- ⚡ Parallel processing with multi-threading
- 🕵️‍♂️ Education gap detection (after 10th, after 12th, before bachelor's)
- 📊 Comprehensive gap analysis and reporting
- 🔄 Synchronous and asynchronous processing
- 📁 File upload support
- 📈 Monitoring and metrics
- 🐳 Docker and Docker Compose support
- 🔒 Redis-based job queue

## API Endpoints

### Health & Monitoring
- `GET /api/health` - Health check
- `GET /api/metrics` - Server metrics
- `GET /api/config` - Configuration

### Extraction
- `POST /api/extract/sync` - Synchronous extraction
- `POST /api/extract/async` - Asynchronous extraction
- `POST /api/upload` - Upload files
- `GET /api/job/{job_id}` - Get job status

### Gap Analysis
- `POST /api/analyze/gaps` - Analyze education gaps
- `GET /api/report/gaps/{job_id}` - Get gap report

## Quick Start

### 1. Clone and Setup
```bash
git clone <repository>
cd academic-records-api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt