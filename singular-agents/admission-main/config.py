import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Configuration for admission letter extraction"""

    # ========== API KEYS ==========
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    # ========== MODEL SETTINGS ==========
    GEMINI_MODEL = "gemini-2.5-flash-lite"
    OPENROUTER_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free"
    GROQ_MODEL = "llama-3.3-70b-versatile"

    # ========== PREPROCESSING ==========
    TARGET_IMAGE_WIDTH = 2000
    SAVE_DEBUG_IMAGES = False

    # ========== CONCURRENCY ==========
    MAX_CONCURRENT_DOCUMENTS = 10
    TIMEOUT_SECONDS = 120
    MAX_PAGES_PER_DOCUMENT = 20

    # ========== TEMPORARY FILES ==========
    TEMP_DIR = Path("temp_admission_sessions")
    AUTO_CLEANUP = True

    # ========== VALIDATION RULES ==========
    MIN_TUITION_FEE = 1000
    MAX_TUITION_FEE = 100000
    MIN_INTAKE_YEAR = 2024
    MAX_FUTURE_YEAR = 2030

    DEGREE_LEVELS = ["bachelor", "master", "phd",
                     "diploma", "certificate", "associate", "other"]
    INTAKE_TERMS = ["fall", "spring", "summer",
                    "winter", "term_1", "term_2", "term_3", "other"]

    @classmethod
    def validate(cls):
        """Validate configuration"""
        if not cls.GEMINI_API_KEY and not cls.OPENROUTER_API_KEY:
            raise ValueError(
                "❌ GEMINI_API_KEY or OPENROUTER_API_KEY required!")
        if not cls.GROQ_API_KEY:
            raise ValueError("❌ GROQ_API_KEY required for verification!")
        cls.TEMP_DIR.mkdir(exist_ok=True)
        print("✅ Admission Letter Configuration validated")


Config.validate()
