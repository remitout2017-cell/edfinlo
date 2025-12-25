"""
Utility functions - CORRECTED
✅ Fixed float comparison with epsilon
✅ Added better validation
"""
import re  # Add this import at top
import json
import hashlib
import logging
from pathlib import Path
from typing import Any, Dict
from datetime import datetime
import time
import math

logger = logging.getLogger(__name__)

# ✅ NEW: Epsilon for float comparisons
FLOAT_EPSILON = 1e-9


def save_json(data: Dict[Any, Any], filepath: str) -> str:
    """
    Save data as JSON file

    Args:
        data: Dictionary to save
        filepath: Output file path

    Returns:
        str: Path to saved file
    """
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        logger.info(f"💾 Saved: {filepath}")
        return filepath
    except Exception as e:
        logger.error(f"❌ Failed to save JSON: {e}")
        raise


def load_json(filepath: str) -> Dict[Any, Any]:
    """
    Load JSON file

    Args:
        filepath: Path to JSON file

    Returns:
        Dict: Loaded data
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"❌ Failed to load JSON: {e}")
        raise


def calculate_file_hash(filepath: str) -> str:
    """
    Calculate SHA256 hash of file

    Args:
        filepath: Path to file

    Returns:
        str: Hash string
    """
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def format_currency(amount: float) -> str:
    """
    Format amount in Indian currency format

    Args:
        amount: Amount to format

    Returns:
        str: Formatted string
    """
    return f"₹{amount:,.2f}"


def calculate_confidence_score(scores: list) -> float:
    """
    Calculate overall confidence from multiple scores

    Args:
        scores: List of confidence scores

    Returns:
        float: Overall confidence (0-1)
    """
    if not scores:
        return 0.0
    return sum(scores) / len(scores)


class Timer:
    """Context manager for timing operations"""

    def __init__(self, name: str = "Operation"):
        self.name = name
        self.start_time = None
        self.end_time = None

    def __enter__(self):
        self.start_time = time.time()
        logger.info(f"⏱️ Starting: {self.name}")
        return self

    def __exit__(self, *args):
        self.end_time = time.time()
        elapsed = self.end_time - self.start_time
        logger.info(f"✅ Completed: {self.name} ({elapsed:.2f}s)")

    @property
    def elapsed(self) -> float:
        """Get elapsed time"""
        if self.end_time:
            return self.end_time - self.start_time
        return time.time() - self.start_time


def create_session_id() -> str:
    """
    Create unique session ID

    Returns:
        str: Session ID
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_suffix = hashlib.sha256(str(time.time()).encode()).hexdigest()[:8]
    return f"{timestamp}_{random_suffix}"


def validate_pdf(filepath: str) -> bool:
    """
    Validate PDF file

    Args:
        filepath: Path to PDF

    Returns:
        bool: True if valid
    """
    path = Path(filepath)

    # Check existence
    if not path.exists():
        logger.error(f"❌ File not found: {filepath}")
        return False

    # Check extension
    if path.suffix.lower() != '.pdf':
        logger.error(f"❌ Not a PDF file: {filepath}")
        return False

    # Check size (not empty, not too large)
    size_mb = path.stat().st_size / (1024 * 1024)
    if size_mb == 0:
        logger.error(f"❌ Empty file: {filepath}")
        return False
    if size_mb > 50:  # 50MB limit
        logger.error(f"❌ File too large ({size_mb:.2f}MB): {filepath}")
        return False

    return True


def setup_logging(log_level: str = "INFO"):
    """
    Setup logging configuration

    Args:
        log_level: Logging level
    """
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )


def calculate_monthly_emi(
    loan_amount: float,
    interest_rate: float,
    tenure_months: int
) -> float:
    """
    Calculate monthly EMI
    ✅ FIXED: Use epsilon for float comparison

    Args:
        loan_amount: Principal amount
        interest_rate: Annual interest rate (%)
        tenure_months: Loan tenure in months

    Returns:
        float: Monthly EMI
    """
    if loan_amount <= 0 or tenure_months <= 0:
        return 0.0

    # Convert annual rate to monthly rate
    monthly_rate = (interest_rate / 12) / 100

    # ✅ FIXED: Use epsilon comparison for zero check
    if abs(monthly_rate) < FLOAT_EPSILON:
        return loan_amount / tenure_months

    # EMI formula: P × r × (1 + r)^n / ((1 + r)^n - 1)
    power_term = math.pow(1 + monthly_rate, tenure_months)
    emi = loan_amount * monthly_rate * power_term / (power_term - 1)

    return round(emi, 2)


def is_float_equal(a: float, b: float, epsilon: float = FLOAT_EPSILON) -> bool:
    """
    ✅ NEW: Compare floats with epsilon tolerance

    Args:
        a: First float
        b: Second float
        epsilon: Tolerance level

    Returns:
        bool: True if approximately equal
    """
    return abs(a - b) < epsilon


def sanitize_pii(text: str, mask_char: str = "*") -> str:
    """
    ✅ NEW: Sanitize PII from text for logging

    Args:
        text: Text containing potential PII
        mask_char: Character to use for masking

    Returns:
        str: Sanitized text
    """
    if not text:
        return text

    # Mask PAN numbers (AAAAA9999A)
    text = re.sub(
        r'\b[A-Z]{5}[0-9]{4}[A-Z]\b',
        f'{mask_char * 5}XXXX{mask_char}',
        text
    )

    # Mask account numbers (8-18 digits)
    text = re.sub(
        r'\b\d{8,18}\b',
        f'{mask_char * 12}',
        text
    )

    # Mask amounts (₹ followed by numbers)
    text = re.sub(
        r'₹[\d,]+\.?\d*',
        f'₹{mask_char * 6}',
        text
    )

    return text


def chunk_list(lst: list, chunk_size: int) -> list:
    """
    ✅ NEW: Split list into chunks

    Args:
        lst: List to chunk
        chunk_size: Size of each chunk

    Returns:
        list: List of chunks
    """
    return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]


def resolve_monthly_income(
    salary_data,
    bank_data,
    itr_data
):
    """
    Decide the most reliable monthly income source.
    Priority:
    1. Salary slips (>=3 months)
    2. Bank salary credits (>=3 months)
    3. ITR average income
    """

    # Salary slip = highest trust
    if salary_data and salary_data.salary_consistency_months >= 3:
        return float(salary_data.average_net_salary), "salary_slip"

    # Bank salary = second priority
    if bank_data and bank_data.salary_consistency_months >= 3:
        return float(bank_data.average_monthly_salary), "bank_salary"

    # ITR fallback
    if itr_data and itr_data.average_monthly_income > 0:
        return float(itr_data.average_monthly_income), "itr"

    return 0.0, "unknown"
