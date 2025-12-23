import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Universal configuration for all Indian education boards"""

    # ========== API KEYS ==========
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    # ========== MODEL SETTINGS ==========
    # Using Gemini 2.0 Flash for native JSON mode support
    GEMINI_MODEL = "gemini-2.0-flash-exp"
    OPENROUTER_MODEL = "google/gemini-flash-1.5"
    GROQ_MODEL = "llama-3.3-70b-versatile"

    # ========== PREPROCESSING ==========
    TARGET_IMAGE_WIDTH = 2000
    SAVE_DEBUG_IMAGES = False

    # ========== CONCURRENCY ==========
    MAX_CONCURRENT_STUDENTS = 10
    TIMEOUT_SECONDS = 120
    MAX_GRADUATION_PAGES = 8  # Process max 8 pages

    # ========== TEMPORARY FILES ==========
    TEMP_DIR = Path("temp_sessions")
    AUTO_CLEANUP = True

    # ========== UNIVERSAL GRADING SYSTEM ==========

    # CBSE 10-point grading scale
    CBSE_GRADE_SCALE = {
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

    # State board division/grade mappings
    STATE_BOARD_GRADES = {
        # Maharashtra
        "distinction": ("A1", 75),
        "i-dist": ("A1", 75),
        "first class": ("A2", 60),
        "i-class": ("A2", 60),
        "second class": ("B1", 50),
        "ii-class": ("B1", 50),
        "pass class": ("C1", 35),

        # Tamil Nadu
        "distinction": ("A1", 75),
        "first": ("A2", 60),
        "second": ("B1", 50),

        # Karnataka
        "distinction": ("A1", 85),
        "first": ("A2", 60),

        # UP Board
        "pratham shreni": ("A2", 60),  # First division
        "dvitiya shreni": ("B1", 45),  # Second division

        # Generic
        "excellent": ("A1", 90),
        "very good": ("A2", 80),
        "good": ("B1", 70),
        "average": ("B2", 60),
        "pass": ("C1", 40)
    }

    # ICSE grade scale
    ICSE_GRADE_SCALE = {
        (85, 100): "A",
        (75, 84): "B",
        (65, 74): "C",
        (55, 64): "D",
        (40, 54): "E",
        (0, 39): "F"
    }

    # University/Graduation CGPA scales
    GRADUATION_CGPA_SCALE = {
        (9.5, 10.0): "O",   # Outstanding
        (9.0, 9.49): "O+",  # Outstanding+
        (8.5, 8.99): "A+",  # Excellent
        (8.0, 8.49): "A",   # Very Good
        (7.0, 7.99): "B+",  # Good
        (6.0, 6.99): "B",   # Above Average
        (5.0, 5.99): "C",   # Average
        (4.0, 4.99): "P",   # Pass
        (0.0, 3.99): "F"    # Fail
    }

    # Board name normalization (for recognition)
    BOARD_KEYWORDS = {
        "cbse": ["cbse", "central board", "new delhi"],
        "icse": ["icse", "isc", "cisce", "council for the indian school"],
        "maharashtra": ["maharashtra", "msbshse", "pune"],
        "tamil_nadu": ["tamil nadu", "tn board", "tamilnadu"],
        "karnataka": ["karnataka", "kseeb", "bengaluru"],
        "kerala": ["kerala", "keam", "dhse"],
        "up": ["up board", "uttar pradesh", "upmsp"],
        "west_bengal": ["wb board", "wbbse", "west bengal"],
        "rajasthan": ["rajasthan", "rbse"],
        "mp": ["madhya pradesh", "mpbse"],
        "ib": ["ib", "international baccalaureate"],
        "cambridge": ["cambridge", "igcse", "caie"],
        "nios": ["nios", "national institute of open schooling"]
    }

    # CGPA conversion factors
    CGPA_TO_PERCENTAGE = {
        "cbse": 9.5,      # CGPA × 9.5
        "icse": 9.5,      # CGPA × 9.5
        "state": 10.0,    # CGPA × 10
        "graduation": 9.5  # CGPA × 9.5
    }

    @classmethod
    def validate(cls):
        """Validate configuration"""
        if not cls.GEMINI_API_KEY and not cls.OPENROUTER_API_KEY:
            raise ValueError(
                "❌ GEMINI_API_KEY or OPENROUTER_API_KEY required!")

        if not cls.GROQ_API_KEY:
            raise ValueError("❌ GROQ_API_KEY required for gap analysis!")

        cls.TEMP_DIR.mkdir(exist_ok=True)
        print("✅ Configuration validated (Universal India mode)")


Config.validate()
