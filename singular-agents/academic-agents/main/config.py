import os
from pathlib import Path  # ADDED THIS
from dotenv import load_dotenv

load_dotenv()


class Config:
    # API Keys
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    # Model settings
    GEMINI_MODEL = "gemini-2.5-flash"
    OPENROUTER_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free"
    GROQ_MODEL = "llama-3.3-70b-versatile"

    # Processing settings
    TARGET_IMAGE_WIDTH = 2000
    TEMP_FOLDER_PREFIX = "student_session_"

    # ========== CONCURRENCY ==========
    MAX_CONCURRENT_STUDENTS = 10
    TIMEOUT_SECONDS = 120  # 2 minutes per student

    TEMP_DIR = Path("temp_sessions")
    AUTO_CLEANUP = True  # Delete temp files after processing

    # CBSE 10-point grading scale
    GRADE_SCALE = {
        (91, 100): "A1",
        (81, 90): "A2",
        (71, 80): "B1",
        (61, 70): "B2",
        (51, 60): "C1",
        (41, 50): "C2",
        (33, 40): "D",
        (21, 32): "E1",
        (0, 20): "E2"
    }

    # ========== VALIDATION ==========
    @classmethod
    def validate(cls):
        """Validate configuration on startup"""
        if not cls.GEMINI_API_KEY and not cls.OPENROUTER_API_KEY:
            raise ValueError(
                "❌ GEMINI_API_KEY or OPENROUTER_API_KEY required!")

        if not cls.GROQ_API_KEY:
            raise ValueError("❌ GROQ_API_KEY required for gap analysis!")

        # Create temp directory
        cls.TEMP_DIR.mkdir(exist_ok=True)

        print("✅ Configuration validated")


Config.validate()
