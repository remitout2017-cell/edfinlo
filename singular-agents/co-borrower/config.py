"""
Production Configuration for Loan Approval AI
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Centralized configuration"""

    # ========== API KEYS ==========
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not found in environment variables")

    # ========== MODEL CONFIGURATION ==========
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    GEMINI_VISION_MODEL = os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")
    TEMPERATURE = float(os.getenv("TEMPERATURE", "0.0"))
    MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
    TIMEOUT = int(os.getenv("TIMEOUT_SECONDS", "120"))

    # ========== DIRECTORIES ==========
    BASE_DIR = Path(__file__).parent
    UPLOAD_DIR = BASE_DIR / "uploads"
    RESULTS_DIR = BASE_DIR / "results"
    CACHE_DIR = BASE_DIR / "cache"
    TEMP_DIR = BASE_DIR / "temp"

    # Create directories
    for dir_path in [UPLOAD_DIR, RESULTS_DIR, CACHE_DIR, TEMP_DIR]:
        dir_path.mkdir(exist_ok=True)

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

    # ========== STUDENT LOAN SPECIFIC ==========
    STUDENT_LOAN_REQUIRED_FIELDS = [
        "applicant_name",
        "monthly_income",
        "annual_income",
        "total_monthly_emi",
        "employment_type",
        "employer_name",
        "bank_account_number",
        "average_monthly_balance",
        "loan_repayment_history",
        "bounce_count",
        "salary_consistency_months"
    ]

    # ========== CACHING ==========
    ENABLE_CACHING = os.getenv("ENABLE_CACHING", "true").lower() == "true"
    CACHE_TTL = int(os.getenv("CACHE_TTL", "3600"))

    # ========== LOGGING ==========
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    ENABLE_METRICS = os.getenv("ENABLE_METRICS", "true").lower() == "true"

    @classmethod
    def validate(cls):
        """Validate configuration"""
        assert cls.GEMINI_API_KEY, "GEMINI_API_KEY is required"
        print("✅ Configuration validated")


Config.validate()
