import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Minimal config for FOIR + CIBIL calculation"""
    
    # ========== API KEYS (ONLY FOR FALLBACK) ==========
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    
    # ========== DIRECTORIES ==========
    TEMP_DIR = Path("temp_foir_sessions")
    AUTO_CLEANUP = True
    
    # ========== FOIR THRESHOLDS ==========
    MAX_FOIR_ACCEPTABLE = 65.0  # 65% is max
    IDEAL_FOIR = 50.0           # 50% is ideal
    
    # ========== CIBIL ESTIMATION ==========
    CIBIL_BANDS = {
        "excellent": (750, 900),
        "good": (700, 749),
        "fair": (650, 699),
        "poor": (550, 649),
        "bad": (300, 549)
    }
    
    # ========== BANK STATEMENT KEYWORDS ==========
    SALARY_KEYWORDS = ["SALARY", "SAL", "NEFT", "RTGS", "IMPS", "CREDIT", "PAY"]
    EMI_KEYWORDS = ["EMI", "LOAN", "FINANCE", "CC", "CREDIT CARD"]
    BOUNCE_KEYWORDS = ["BOUNCE", "RETURN", "INSUFFICIENT", "DISHONOUR"]
    
    @classmethod
    def validate(cls):
        cls.TEMP_DIR.mkdir(exist_ok=True)
        print("✅ FOIR/CIBIL Config validated")

Config.validate()
