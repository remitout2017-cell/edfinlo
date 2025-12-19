import json
import re
from pathlib import Path
from typing import Any

def save_json(data: Any, filename: str) -> str:
    """Save JSON file"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    print(f"💾 Saved: {filename}")
    return filename

def extract_amount(text: str) -> float:
    """Extract numeric amount from text like '₹25,000.00' or '25000'"""
    if not text:
        return 0.0
    
    # Remove currency symbols and commas
    cleaned = re.sub(r'[₹$,\s]', '', str(text))
    
    # Extract first number
    match = re.search(r'[\d.]+', cleaned)
    if match:
        try:
            return float(match.group())
        except:
            return 0.0
    return 0.0

def is_salary_transaction(description: str) -> bool:
    """Check if transaction is salary credit"""
    from config import Config
    desc = str(description).upper()
    return any(kw in desc for kw in Config.SALARY_KEYWORDS)

def is_emi_transaction(description: str) -> bool:
    """Check if transaction is EMI debit"""
    from config import Config
    desc = str(description).upper()
    return any(kw in desc for kw in Config.EMI_KEYWORDS)

def is_bounce_transaction(description: str) -> bool:
    """Check if transaction is bounced"""
    from config import Config
    desc = str(description).upper()
    return any(kw in desc for kw in Config.BOUNCE_KEYWORDS)
