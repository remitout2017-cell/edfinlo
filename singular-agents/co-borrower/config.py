"""
Configuration - CORRECTED
✅ Added missing batch size configurations
✅ Added LRU cache size configuration
✅ Better organization
"""

import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Application configuration"""

    # ============================================================================
    # ENVIRONMENT
    # ============================================================================
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    DEBUG = ENVIRONMENT == "development"

    # ============================================================================
    # API KEYS
    # ============================================================================
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is required")

    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY environment variable is required")

    # ============================================================================
    # MODELS
    # ============================================================================
    GEMINI_MODEL = "gemini-2.0-flash-exp"  # For document extraction
    GEMINI_VISION_MODEL = "gemini-2.0-flash-exp"  # For image processing
    GROQ_MODEL = "llama-3.3-70b-versatile"  # For FOIR calculation

    # ============================================================================
    # LLM SETTINGS
    # ============================================================================
    TIMEOUT = 300  # 5 minutes
    MAX_RETRIES = 3
    MAX_OUTPUT_TOKENS = 8192

    # ============================================================================
    # PDF PROCESSING
    # ============================================================================
    MAX_PDF_PAGES = 50
    PDF_DPI = 150  # ✅ OPTIMIZED: Reduced from 200 for better performance
    PDF_MAX_IMAGE_SIZE = (1536, 1536)  # Max image dimensions
    PDF_JPEG_QUALITY = 85  # JPEG compression quality

    # ✅ NEW: Batch processing configuration
    BANK_STATEMENT_BATCH_SIZE = 10  # Pages per batch for bank statements
    ITR_BATCH_SIZE = 5  # Pages per batch for ITR
    SALARY_BATCH_SIZE = 5  # Pages per batch for salary slips

    # ✅ NEW: Cache configuration
    LRU_CACHE_SIZE = 50  # Number of PDFs to cache in memory

    # ============================================================================
    # FILE UPLOADS
    # ============================================================================
    MAX_FILE_SIZE_MB = 20
    MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
    ALLOWED_EXTENSIONS = {".pdf"}

    # ============================================================================
    # DIRECTORIES
    # ============================================================================
    BASE_DIR = Path(__file__).parent
    UPLOAD_DIR = BASE_DIR / "uploads"
    RESULTS_DIR = BASE_DIR / "results"
    SESSIONS_DIR = RESULTS_DIR / "sessions"
    LOG_DIR = BASE_DIR / "logs"

    # Create directories
    UPLOAD_DIR.mkdir(exist_ok=True)
    RESULTS_DIR.mkdir(exist_ok=True)
    SESSIONS_DIR.mkdir(exist_ok=True)
    LOG_DIR.mkdir(exist_ok=True)

    # ============================================================================
    # LOGGING
    # ============================================================================
    LOG_LEVEL = "INFO" if DEBUG else "WARNING"
    LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

    # ✅ NEW: Sensitive data masking in logs
    MASK_SENSITIVE_DATA = not DEBUG  # Mask PII in production

    # ============================================================================
    # API SETTINGS
    # ============================================================================
    API_HOST = "0.0.0.0"
    API_PORT = int(os.getenv("PORT", 8000))
    API_WORKERS = 2

    # CORS
    CORS_ORIGINS = ["*"] if DEBUG else [
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    # ✅ NEW: Rate limiting (requests per minute)
    RATE_LIMIT_PER_MINUTE = 30 if DEBUG else 10

    # ============================================================================
    # BUSINESS RULES
    # ============================================================================
    # FOIR thresholds
    FOIR_EXCELLENT = 40.0
    FOIR_GOOD = 50.0
    FOIR_ACCEPTABLE = 65.0
    FOIR_HIGH = 80.0

    # CIBIL score ranges
    CIBIL_EXCELLENT = 750
    CIBIL_GOOD = 700
    CIBIL_FAIR = 650
    CIBIL_POOR = 550

    # ✅ NEW: Validation thresholds
    MIN_SALARY_CONSISTENCY_MONTHS = 3  # Minimum months of salary for good confidence
    MIN_ITR_YEARS = 1  # Minimum ITR years required
    MAX_ACCEPTABLE_BOUNCE_COUNT = 2  # Warning threshold for bounces

    # ============================================================================
    # FEATURE FLAGS
    # ============================================================================
    # ✅ NEW: Feature toggles
    ENABLE_CIBIL_ESTIMATION = True  # Estimate CIBIL if report not provided
    ENABLE_FORM16_PROCESSING = False  # Form16 processing (future feature)
    ENABLE_METRICS_COLLECTION = True  # Collect processing metrics
    ENABLE_DETAILED_LOGGING = DEBUG  # Detailed logging for debugging

    # ============================================================================
    # PERFORMANCE TUNING
    # ============================================================================
    # ✅ NEW: Performance settings
    ASYNCIO_SEMAPHORE_LIMIT = 10  # Max concurrent async operations
    PDF_PROCESSING_TIMEOUT = 60  # Seconds per PDF
    LLM_REQUEST_TIMEOUT = 30  # Seconds per LLM request

    @classmethod
    def get_config_summary(cls) -> dict:
        """Get configuration summary for health checks"""
        return {
            "environment": cls.ENVIRONMENT,
            "models": {
                "gemini": cls.GEMINI_MODEL,
                "groq": cls.GROQ_MODEL
            },
            "limits": {
                "max_file_size_mb": cls.MAX_FILE_SIZE_MB,
                "max_pdf_pages": cls.MAX_PDF_PAGES,
                "pdf_dpi": cls.PDF_DPI,
                "rate_limit_per_minute": cls.RATE_LIMIT_PER_MINUTE
            },
            "features": {
                "cibil_estimation": cls.ENABLE_CIBIL_ESTIMATION,
                "form16_processing": cls.ENABLE_FORM16_PROCESSING,
                "metrics_collection": cls.ENABLE_METRICS_COLLECTION
            }
        }
