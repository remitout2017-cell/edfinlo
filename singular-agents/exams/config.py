import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Configuration for test score extraction"""

    # ========== API KEYS ==========
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    # ========== MODEL SETTINGS ==========
    GEMINI_MODEL = "gemini-2.5-flash-lite"
    OPENROUTER_MODEL = "google/gemini-flash-1.5"
    GROQ_MODEL = "llama-3.3-70b-versatile"

    # ========== PREPROCESSING ==========
    TARGET_IMAGE_WIDTH = 2000
    SAVE_DEBUG_IMAGES = False

    # ========== CONCURRENCY ==========
    MAX_CONCURRENT_DOCUMENTS = 5
    TIMEOUT_SECONDS = 120
    MAX_PAGES_PER_DOCUMENT = 10

    # ========== TEMPORARY FILES ==========
    TEMP_DIR = Path("temp_test_scores")
    AUTO_CLEANUP = True

    # ========== VALIDATION RULES ==========
    # TOEFL
    TOEFL_MIN_SCORE = 0
    TOEFL_MAX_SECTION_SCORE = 30
    TOEFL_MAX_TOTAL_SCORE = 120
    TOEFL_VALIDITY_YEARS = 2

    # GRE
    GRE_MIN_VERBAL_QUANT = 130
    GRE_MAX_VERBAL_QUANT = 170
    GRE_MIN_WRITING = 0.0
    GRE_MAX_WRITING = 6.0
    GRE_VALIDITY_YEARS = 5

    # IELTS
    IELTS_MIN_BAND = 0.0
    IELTS_MAX_BAND = 9.0
    IELTS_BAND_INCREMENT = 0.5
    IELTS_VALIDITY_YEARS = 2

    @classmethod
    def validate(cls):
        """Validate configuration"""
        if not cls.GEMINI_API_KEY and not cls.OPENROUTER_API_KEY:
            raise ValueError(
                "❌ GEMINI_API_KEY or OPENROUTER_API_KEY required!")
        if not cls.GROQ_API_KEY:
            raise ValueError("❌ GROQ_API_KEY required for verification!")

        cls.TEMP_DIR.mkdir(exist_ok=True)
        print("✅ Test Score Configuration validated")


Config.validate()
