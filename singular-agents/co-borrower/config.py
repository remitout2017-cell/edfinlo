"""
Production Configuration for Loan Approval AI - CORRECTED
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Check if .env exists
env_path = Path(__file__).parent / ".env"
if not env_path.exists():
    print("⚠️  .env file not found. Creating from .env.example...")
    print("⚠️  Please update .env with your actual GEMINI_API_KEY")

load_dotenv()


class Config:
    """Centralized configuration"""

    # ========== API KEYS ==========
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        raise ValueError(
            "❌ GEMINI_API_KEY not found in environment variables. "
            "Please set it in .env file"
        )

    # ========== MODEL CONFIGURATION ==========
    # Updated to stable model versions
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    GEMINI_VISION_MODEL = os.getenv("GEMINI_VISION_MODEL", "gemini-1.5-flash")
    TEMPERATURE = float(os.getenv("TEMPERATURE", "0.0"))
    MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
    TIMEOUT = int(os.getenv("TIMEOUT_SECONDS", "120"))

    # ========== DIRECTORIES ==========
    BASE_DIR = Path(__file__).parent
    UPLOAD_DIR = BASE_DIR / "uploads"
    RESULTS_DIR = BASE_DIR / "results"
    CACHE_DIR = BASE_DIR / "cache"
    TEMP_DIR = BASE_DIR / "temp"
    LOGS_DIR = BASE_DIR / "logs"

    # Create directories
    for dir_path in [UPLOAD_DIR, RESULTS_DIR, CACHE_DIR, TEMP_DIR, LOGS_DIR]:
        dir_path.mkdir(exist_ok=True, parents=True)

    # ========== FILE UPLOAD LIMITS ==========
    MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
    MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
    ALLOWED_EXTENSIONS = {'.pdf'}

    # ========== FOIR THRESHOLDS ==========
    MAX_FOIR_ACCEPTABLE = 65.0
    IDEAL_FOIR = 50.0
    CRITICAL_FOIR = 80.0

    # ========== CIBIL SCORE BANDS ==========
    CIBIL_BANDS = {
        "excellent": (750, 900),
        "good": (700, 749),
        "fair": (650, 699),
        "poor": (550, 649),
        "very_poor": (300, 549)
    }

    # ========== PROCESSING LIMITS ==========
    MAX_PDF_PAGES = int(os.getenv("MAX_PDF_PAGES", "30"))
    PDF_DPI = int(os.getenv("PDF_DPI", "200"))

    # ========== API SETTINGS ==========
    API_HOST = os.getenv("API_HOST", "0.0.0.0")
    API_PORT = int(os.getenv("API_PORT", "8000"))
    API_WORKERS = int(os.getenv("API_WORKERS", "2"))

    # ========== CORS SETTINGS ==========
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

    # ========== CACHING ==========
    ENABLE_CACHING = os.getenv("ENABLE_CACHING", "false").lower() == "true"
    CACHE_TTL = int(os.getenv("CACHE_TTL", "3600"))

    # ========== LOGGING ==========
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    ENABLE_METRICS = os.getenv("ENABLE_METRICS", "true").lower() == "true"
    LOG_FILE = LOGS_DIR / "app.log"

    # ========== ENVIRONMENT ==========
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"

    @classmethod
    def validate(cls):
        """Validate configuration"""
        assert cls.GEMINI_API_KEY, "❌ GEMINI_API_KEY is required"
        assert cls.GEMINI_API_KEY.startswith(
            "AIza"), "❌ Invalid GEMINI_API_KEY format"
        print("✅ Configuration validated")
        print(f"   Model: {cls.GEMINI_MODEL}")
        print(f"   Vision Model: {cls.GEMINI_VISION_MODEL}")
        print(f"   Environment: {cls.ENVIRONMENT}")

    @classmethod
    def get_summary(cls):
        """Get configuration summary"""
        return {
            "environment": cls.ENVIRONMENT,
            "debug": cls.DEBUG,
            "model": cls.GEMINI_MODEL,
            "vision_model": cls.GEMINI_VISION_MODEL,
            "max_file_size_mb": cls.MAX_FILE_SIZE_MB,
            "max_pdf_pages": cls.MAX_PDF_PAGES,
            "api_host": cls.API_HOST,
            "api_port": cls.API_PORT
        }


# Validate on import
try:
    Config.validate()
except Exception as e:
    print(f"❌ Configuration error: {e}")
    print("Please check your .env file")
    raise
