import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configuration for work experience extraction"""
    
    # ========== API KEYS ==========
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    
    # ========== MODEL SETTINGS ==========
    GEMINI_MODEL = "gemini-1.5-flash"
    OPENROUTER_MODEL = "google/gemini-flash-1.5"
    GROQ_MODEL = "llama-3.3-70b-versatile"
    
    # ========== PREPROCESSING ==========
    TARGET_IMAGE_WIDTH = 2000
    SAVE_DEBUG_IMAGES = False
    
    # ========== CONCURRENCY ==========
    MAX_CONCURRENT_DOCUMENTS = 10
    TIMEOUT_SECONDS = 120
    MAX_PAGES_PER_DOCUMENT = 20  # Max pages to process per document
    
    # ========== TEMPORARY FILES ==========
    TEMP_DIR = Path("temp_sessions")
    AUTO_CLEANUP = True
    
    # ========== VALIDATION RULES ==========
    MIN_SALARY = 1000
    MAX_SALARY = 10000000
    MIN_START_YEAR = 1980
    MAX_FUTURE_YEAR = 2026
    
    # Employment types
    EMPLOYMENT_TYPES = [
        "full_time",
        "part_time", 
        "contract",
        "internship_paid",
        "internship_unpaid",
        "freelance",
        "volunteer",
        "temporary"
    ]
    
    # Date formats to try parsing
    DATE_FORMATS = [
        "%d/%m/%Y",   # 15/03/2023
        "%d-%m-%Y",   # 15-03-2023
        "%d.%m.%Y",   # 15.03.2023
        "%Y-%m-%d",   # 2023-03-15
        "%d %B %Y",   # 15 March 2023
        "%d %b %Y",   # 15 Mar 2023
        "%B %d, %Y",  # March 15, 2023
    ]
    
    @classmethod
    def validate(cls):
        """Validate configuration"""
        if not cls.GEMINI_API_KEY and not cls.OPENROUTER_API_KEY:
            raise ValueError("❌ GEMINI_API_KEY or OPENROUTER_API_KEY required!")
        
        if not cls.GROQ_API_KEY:
            raise ValueError("❌ GROQ_API_KEY required for verification!")
        
        cls.TEMP_DIR.mkdir(exist_ok=True)
        print("✅ Work Experience Configuration validated")

Config.validate()