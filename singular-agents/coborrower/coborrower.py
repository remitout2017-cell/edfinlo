import os
import json
from typing import TypedDict, Annotated, List, Dict, Any
from enum import Enum
import operator
from pathlib import Path
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END, START
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
import pdfplumber
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image
import io
import base64
import tempfile

# Add pdf2image for PDF to image conversion
try:
    from pdf2image import convert_from_path, convert_from_bytes
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    print("⚠️ pdf2image not installed. Please install with: pip install pdf2image")
    PDF2IMAGE_AVAILABLE = False

# Check for poppler on Windows
if os.name == 'nt':
    POPPLER_PATH = r"C:\Program Files\poppler\Library\bin"  # Default Windows installation path
    if not os.path.exists(POPPLER_PATH):
        print("⚠️ Poppler not found. Please install poppler for Windows.")
        print("   Download from: https://github.com/oschwartz10612/poppler-windows/releases")
        print("   Extract to: C:\\Program Files\\poppler")
        PDF2IMAGE_AVAILABLE = False

load_dotenv()

if not os.getenv("GROQ_API_KEY"):
    raise ValueError("GROQ_API_KEY not found in environment variables!")
if not os.getenv("GEMINI_API_KEY"):
    raise ValueError("GEMINI_API_KEY not found in environment variables!")

print("✅ Environment variables loaded for CoBorrower financial agent")

# =============================================================================
# CONFIG WITH RATE LIMITING
# =============================================================================
class Config:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
    EXTRACTION_MODEL = os.getenv("EXTRACTION_MODEL", "gemini-2.0-flash-exp")
    VERIFICATION_MODEL = os.getenv("VERIFICATION_MODEL", "llama-3.3-70b-versatile")
    
    # Image configuration
    USE_IMAGES_FOR_EXTRACTION = True  # Set to True to use images instead of text
    IMAGE_DPI = 150  # DPI for image conversion
    IMAGE_FORMAT = "JPEG"  # JPEG or PNG
    MAX_PAGES_PER_DOC = 20  # Maximum pages to convert per document
    COMPRESS_IMAGES = True  # Compress images to reduce size
    
    # For text fallback
    TEXT_EXTRACTION_FALLBACK = True  # Fall back to text extraction if image fails
    
    # Rate limiting config for Gemini free tier
    REQUESTS_PER_MINUTE = 10
    MIN_DELAY_BETWEEN_REQUESTS = 6.5  # seconds (to stay under 10 RPM)
    BASE_BACKOFF_DELAY = 2.0
    MAX_BACKOFF_DELAY = 60.0

    @classmethod
    def validate(cls):
        if not cls.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY is missing!")
        if not cls.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is missing!")
        if cls.USE_IMAGES_FOR_EXTRACTION and not PDF2IMAGE_AVAILABLE:
            print("⚠️ PDF to image conversion disabled - pdf2image not available")
            cls.USE_IMAGES_FOR_EXTRACTION = False
        print(f"✅ CoBorrower Config validated - Max Retries: {cls.MAX_RETRIES}")
        print(f"📸 Image extraction: {'ENABLED' if cls.USE_IMAGES_FOR_EXTRACTION else 'DISABLED'}")
        print(f"⏱️ Rate limiting: {cls.REQUESTS_PER_MINUTE} RPM, {cls.MIN_DELAY_BETWEEN_REQUESTS}s between requests")

Config.validate()

# =============================================================================
# RATE LIMITER CLASS
# =============================================================================
class RateLimiter:
    """Simple rate limiter to avoid hitting Gemini API limits"""
    def __init__(self, requests_per_minute=10):
        self.requests_per_minute = requests_per_minute
        self.min_interval = 60.0 / requests_per_minute
        self.last_request_time = 0.0

    def wait_if_needed(self):
        """Wait if necessary to respect rate limits"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time

        if time_since_last < self.min_interval:
            sleep_time = self.min_interval - time_since_last
            print(f"⏳ Rate limiting: waiting {sleep_time:.2f}s...")
            time.sleep(sleep_time)

        self.last_request_time = time.time()

# Global rate limiter instance
rate_limiter = RateLimiter(Config.REQUESTS_PER_MINUTE)

# =============================================================================
# DOCUMENT TYPE ENUM
# =============================================================================
class FinancialDocType(str, Enum):
    SALARY_SLIP_1 = "salary_slip_1"
    SALARY_SLIP_2 = "salary_slip_2"
    SALARY_SLIP_3 = "salary_slip_3"
    ITR_1 = "itr_1"
    ITR_2 = "itr_2"
    ITR_3 = "itr_3"
    FORM16 = "form_16"
    BANK_STATEMENT_6M = "bank_statement_6m"

# =============================================================================
# STATE
# =============================================================================
class CoBorrowerFinancialState(TypedDict):
    """Shared state across the CoBorrower financial graph"""
    pdfs: Dict[str, str]
    pdf_metadata: Dict[str, Any]
    pdf_images: Dict[str, List[str]]  # NEW: Store base64 encoded images
    extracted_data: Dict[str, Any]
    retry_counts: Dict[str, int]
    extraction_status: Dict[str, str]
    verification_result: Dict[str, Any]
    final_json: Dict[str, Any]
    status: str
    errors: Annotated[List[str], operator.add]

# =============================================================================
# PDF TO IMAGE CONVERSION HELPERS
# =============================================================================
def convert_pdf_to_images(pdf_path: str, max_pages: int = None) -> List[str]:
    """
    Convert PDF pages to base64 encoded images
    
    Args:
        pdf_path: Path to PDF file
        max_pages: Maximum number of pages to convert (None for all)
        
    Returns:
        List of base64 encoded image strings
    """
    if not Config.USE_IMAGES_FOR_EXTRACTION or not PDF2IMAGE_AVAILABLE:
        return []
    
    if not pdf_path or not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    
    try:
        print(f"🔄 Converting PDF to images: {os.path.basename(pdf_path)}")
        
        # Convert PDF to images
        if os.name == 'nt' and os.path.exists(POPPLER_PATH):
            images = convert_from_path(
                pdf_path, 
                dpi=Config.IMAGE_DPI,
                poppler_path=POPPLER_PATH
            )
        else:
            images = convert_from_path(
                pdf_path, 
                dpi=Config.IMAGE_DPI
            )
        
        # Limit number of pages if specified
        if max_pages and len(images) > max_pages:
            images = images[:max_pages]
        
        base64_images = []
        for i, image in enumerate(images):
            # Convert PIL Image to base64
            img_byte_arr = io.BytesIO()
            
            # Compress if enabled
            if Config.COMPRESS_IMAGES:
                image.save(img_byte_arr, format=Config.IMAGE_FORMAT, 
                          quality=85, optimize=True)
            else:
                image.save(img_byte_arr, format=Config.IMAGE_FORMAT)
            
            img_byte_arr.seek(0)
            base64_str = base64.b64encode(img_byte_arr.read()).decode('utf-8')
            base64_images.append(base64_str)
            
            print(f"  → Page {i+1}: {len(base64_str) // 1024} KB")
        
        print(f"✅ Converted {len(base64_images)} pages to images")
        return base64_images
        
    except Exception as e:
        print(f"❌ Error converting PDF to images: {str(e)}")
        if Config.TEXT_EXTRACTION_FALLBACK:
            print("⚠️ Falling back to text extraction")
            return []
        else:
            raise

def prepare_images_for_gemini(images: List[str], max_images: int = 16) -> List[Dict[str, Any]]:
    """
    Prepare images for Gemini API (supports up to 16 images per request)
    
    Args:
        images: List of base64 encoded images
        max_images: Maximum images to send per request
        
    Returns:
        List of image dictionaries for Gemini API
    """
    if not images:
        return []
    
    # Limit number of images
    images = images[:max_images]
    
    gemini_images = []
    for i, img_base64 in enumerate(images):
        gemini_images.append({
            "mime_type": f"image/{Config.IMAGE_FORMAT.lower()}",
            "data": img_base64
        })
    
    return gemini_images

# =============================================================================
# HELPERS
# =============================================================================
def read_pdf_with_images(path: str) -> Dict[str, Any]:
    """
    Read a PDF and return text + images
    
    Returns:
        Dict with text, images, page_count, and filename
    """
    if not path or path.strip() == "":
        raise ValueError("PDF path is empty")

    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    try:
        # Extract text using pdfplumber (fallback)
        with pdfplumber.open(str(file_path)) as pdf:
            pages_text = []
            for page in pdf.pages:
                pages_text.append(page.extract_text() or "")
            full_text = "\n\n".join(pages_text)
            page_count = len(pdf.pages)

        # Convert to images if enabled
        images = []
        if Config.USE_IMAGES_FOR_EXTRACTION and PDF2IMAGE_AVAILABLE:
            try:
                images = convert_pdf_to_images(str(file_path), Config.MAX_PAGES_PER_DOC)
            except Exception as img_error:
                print(f"⚠️ Image conversion failed, using text only: {str(img_error)}")
                images = []

        return {
            "text": full_text,
            "images": images,  # List of base64 encoded images
            "page_count": page_count,
            "filename": file_path.name,
        }
    except Exception as e:
        raise Exception(f"Failed to read PDF {path}: {str(e)}")

def read_pdf_text_only(path: str) -> Dict[str, Any]:
    """Fallback function to read PDF text only (no images)"""
    if not path or path.strip() == "":
        raise ValueError("PDF path is empty")

    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    try:
        with pdfplumber.open(str(file_path)) as pdf:
            pages_text = []
            for page in pdf.pages:
                pages_text.append(page.extract_text() or "")
            full_text = "\n\n".join(pages_text)
            page_count = len(pdf.pages)

            return {
                "text": full_text,
                "images": [],
                "page_count": page_count,
                "filename": file_path.name,
            }
    except Exception as e:
        raise Exception(f"Failed to read PDF {path}: {str(e)}")

def parse_llm_json(response: str) -> Dict[str, Any]:
    """Extract JSON object from LLM response content."""
    try:
        # Try to find JSON in code blocks first
        if "```json" in response:
            start = response.find("```json") + 7
            end = response.find("```", start)
            if end > start:
                json_str = response[start:end].strip()
                return json.loads(json_str)

        # Fall back to finding raw JSON
        start = response.find("{")
        end = response.rfind("}") + 1
        if start != -1 and end > start:
            json_str = response[start:end]
            return json.loads(json_str)
    except Exception as e:
        return {"error": f"Parse error: {str(e)}", "raw_response": response[:500]}

    return {"error": "No valid JSON found in response", "raw_response": response[:500]}

# =============================================================================
# AI MODELS WITH RETRY LOGIC (UPDATED FOR IMAGES)
# =============================================================================
class AIModels:
    _gemini_text = None
    _gemini_vision = None  # NEW: Vision model for images
    _groq_verifier = None

    @classmethod
    def get_gemini_text(cls):
        if cls._gemini_text is None:
            cls._gemini_text = ChatGoogleGenerativeAI(
                google_api_key=Config.GEMINI_API_KEY,
                model=Config.EXTRACTION_MODEL,
                temperature=0.1,
                max_output_tokens=4000,
            )
            print("✅ Gemini text model initialized (financial)")
        return cls._gemini_text

    @classmethod
    def get_gemini_vision(cls):
        """Initialize Gemini for vision/Image analysis"""
        if cls._gemini_vision is None:
            # Use a vision-capable model
            vision_model = "gemini-1.5-flash" if "gemini" in Config.EXTRACTION_MODEL else Config.EXTRACTION_MODEL
            cls._gemini_vision = ChatGoogleGenerativeAI(
                google_api_key=Config.GEMINI_API_KEY,
                model=vision_model,
                temperature=0.1,
                max_output_tokens=4000,
            )
            print("✅ Gemini vision model initialized (financial)")
        return cls._gemini_vision

    @classmethod
    def get_groq_verifier(cls):
        if cls._groq_verifier is None:
            cls._groq_verifier = ChatGroq(
                groq_api_key=Config.GROQ_API_KEY,
                model_name=Config.VERIFICATION_MODEL,
                temperature=0.2,
                max_tokens=3000,
            )
            print("✅ Groq verifier model initialized (financial)")
        return cls._groq_verifier

    @classmethod
    def invoke_with_images(cls, prompt: str, images: List[Dict[str, Any]], max_retries=3):
        """Invoke Gemini with images"""
        model = cls.get_gemini_vision()
        
        # Prepare messages with images
        content = [prompt]
        for img_data in images:
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{img_data['mime_type']};base64,{img_data['data']}"
                }
            })
        
        messages = [HumanMessage(content=content)]
        
        return cls.invoke_with_retry(model, messages, max_retries)

    @classmethod
    def invoke_with_retry(cls, model, messages, max_retries=3):
        """Invoke model with exponential backoff retry logic"""
        last_exception = None

        for attempt in range(max_retries):
            try:
                # Wait for rate limiter
                rate_limiter.wait_if_needed()

                # Make the API call
                response = model.invoke(messages)
                return response

            except Exception as e:
                last_exception = e
                error_str = str(e)

                # Check if it's a rate limit error
                if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str or "quota" in error_str.lower():
                    if attempt == max_retries - 1:
                        raise

                    # Extract wait time from error message if available
                    wait_time = Config.BASE_BACKOFF_DELAY * (2 ** attempt)

                    # Try to parse wait time from error message
                    if "retry in" in error_str.lower():
                        try:
                            import re
                            match = re.search(r"(\d+\.?\d*)s", error_str)
                            if match:
                                suggested_wait = float(match.group(1))
                                wait_time = max(wait_time, suggested_wait)
                        except:
                            pass

                    # Add jitter
                    wait_time = min(wait_time + random.uniform(0, 2), Config.MAX_BACKOFF_DELAY)

                    print(f"⚠️ Rate limited. Retry {attempt + 1}/{max_retries} in {wait_time:.2f}s")
                    time.sleep(wait_time)
                else:
                    # Non-rate-limit errors should bubble up immediately
                    raise

        raise last_exception

# =============================================================================
# UPDATED PROMPTS FOR IMAGE EXTRACTION
# =============================================================================
SALARY_SLIP_PROMPT = """You are extracting structured salary slip data from images for a loan underwriting system.

IMPORTANT: Carefully analyze each image and extract ALL numeric values. Look for:
- Gross Salary / Gross Pay / Total Earnings
- Net Salary / Net Pay / Take Home
- Basic Salary / Basic Pay
- HRA (House Rent Allowance)
- Other Allowances (Special Allowance, DA, etc.)
- Deductions: PF, Tax/TDS, Insurance, Professional Tax, etc.
- Month and Year
- Employer Name

Return ONLY valid JSON with this EXACT structure:
{
  "month": "January",
  "year": 2024,
  "grossSalary": 50000.00,
  "netSalary": 42000.00,
  "basicSalary": 25000.00,
  "hra": 12500.00,
  "allowances": 12500.00,
  "deductions": {
    "pf": 2400.00,
    "tax": 3200.00,
    "insurance": 500.00,
    "other": 1500.00
  },
  "employerName": "ABC Company Pvt Ltd",
  "extraction_confidence": 0.95
}

Rules:
- All numbers must be numeric (float/int), NOT strings
- If a field is unclear, use null (not 0)
- extraction_confidence should be 0.9-1.0 if you found all major fields
- extraction_confidence should be 0.5-0.8 if some fields are missing
- extraction_confidence should be <0.5 if most fields are unclear
- Analyze all provided images carefully
- Do NOT include markdown, explanations, or extra keys
"""

ITR_PROMPT = """You are extracting INCOME TAX RETURN (ITR) data from images for loan underwriting.

ANALYZE ALL IMAGES CAREFULLY and look for:
- Assessment Year (AY): e.g., "2023-24"
- Financial Year (FY): e.g., "2022-23"
- Total Income / Gross Total Income
- Tax Paid / Total Tax
- Filing Date / Date of Filing
- Income from Salary (if itemized)
- Income from Business/Profession
- Income from Other Sources
- Acknowledgement Number / Receipt Number
- Whether ITR is e-verified/acknowledged

Return ONLY valid JSON with this EXACT structure:
{
  "assessmentYear": "2023-24",
  "financialYear": "2022-23",
  "totalIncome": 850000.00,
  "taxPaid": 45000.00,
  "filingDate": "2023-07-31",
  "incomeFromSalary": 850000.00,
  "incomeFromBusiness": 0.00,
  "incomeFromOtherSources": 0.00,
  "acknowledged": true,
  "acknowledgmentNumber": "123456789012345",
  "extraction_confidence": 0.92
}

Rules:
- All amounts must be numeric (float/int), NOT strings
- Dates in YYYY-MM-DD format
- If a field is not present, use null
- extraction_confidence: 0.9-1.0 if all major fields found
- extraction_confidence: 0.7-0.9 if some minor fields missing
- extraction_confidence: <0.7 if major fields unclear
- Analyze all image pages thoroughly
- Do NOT include markdown, explanations, or extra keys
"""

FORM16_PROMPT = """You are extracting FORM 16 (TDS Certificate) data from images.

ANALYZE ALL IMAGES and look for:
- Financial Year
- Employer Name / Name of Employer
- Gross Salary / Total Salary
- Standard Deduction
- Taxable Income / Income Chargeable to Tax
- TDS Deducted / Tax Deducted at Source
- PAN Number (of employee)

Return ONLY valid JSON:
{
  "financialYear": "2023-24",
  "employerName": "ABC Company Pvt Ltd",
  "grossSalary": 1000000.00,
  "standardDeduction": 50000.00,
  "taxableIncome": 950000.00,
  "tdsDeducted": 78000.00,
  "panNumber": "ABCDE1234F",
  "extraction_confidence": 0.9
}

Rules:
- All amounts numeric
- If missing, use null
- High confidence (0.9+) only if all major fields found
- Carefully examine each image page
"""

BANK_STATEMENT_PROMPT = """You are extracting data from a 6-MONTH BANK STATEMENT images for loan underwriting.

ANALYZE EACH IMAGE PAGE THOROUGHLY and look for:
- Account Number
- Bank Name
- IFSC Code
- Account Type (Savings/Current)
- Statement Period (From Date - To Date)
- For EACH MONTH visible:
  - Opening Balance
  - Closing Balance
  - Total Credits (all deposits)
  - Total Debits (all withdrawals)
  - Salary Credit (look for "SALARY", "SAL", or regular monthly credit)
  - EMI Payments (look for "EMI", "LOAN", "FINANCE")
  - Minimum Balance in that month
  - Any bounced payments/cheques

Return ONLY valid JSON with this EXACT structure:
{
  "accountNumber": "1234567890",
  "bankName": "HDFC Bank",
  "ifscCode": "HDFC0001234",
  "accountType": "savings",
  "statementPeriod": {
    "from": "2024-01-01",
    "to": "2024-06-30"
  },
  "monthlyData": [
    {
      "month": "January",
      "year": 2024,
      "openingBalance": 50000.00,
      "closingBalance": 45000.00,
      "totalCredits": 60000.00,
      "totalDebits": 65000.00,
      "salaryCredit": 50000.00,
      "emiPayments": 15000.00,
      "minBalance": 42000.00,
      "bounces": 0
    }
  ],
  "averageMonthlyBalance": 45000.00,
  "totalEmiObserved": 90000.00,
  "salaryConsistency": "stable",
  "extraction_confidence": 0.88
}

Rules:
- Include ALL months visible in statement (minimum 6)
- All amounts numeric
- salaryConsistency: "stable" (same amount ±10%), "variable" (fluctuating), "irregular" (missing months)
- totalEmiObserved: sum of all EMI payments across all months
- averageMonthlyBalance: average of closing balances
- extraction_confidence: 0.9+ if all 6 months with complete data
- extraction_confidence: 0.7-0.9 if 4-5 months or some missing data
- extraction_confidence: <0.7 if less than 4 months or major fields missing
- Analyze transaction tables carefully in each image
"""

# =============================================================================
# UPDATED EXTRACTOR WITH IMAGE SUPPORT
# =============================================================================
def run_extractor_for_doc_type(
    state: CoBorrowerFinancialState,
    doc_type: FinancialDocType,
    system_prompt: str,
) -> CoBorrowerFinancialState:
    """
    Generic extractor with image support and fallback to text
    """
    key = doc_type.value
    print(f"\n🔍 [{key}] Starting extraction...")

    is_optional = (doc_type == FinancialDocType.FORM16)
    pdf_path = state["pdfs"].get(key, "")

    if (not pdf_path or pdf_path.strip() == "") and is_optional:
        state["extraction_status"][key] = "success"
        state["extracted_data"][key] = {"note": "Form 16 not provided (optional)"}
        print(f"ℹ️ [{key}] Not provided (optional document)")
        return state

    if not pdf_path or pdf_path.strip() == "":
        state["extraction_status"][key] = "failed"
        state["errors"].append(f"{key}: Empty or missing PDF path")
        print(f"❌ [{key}] Empty or missing PDF path")
        return state

    retry_count = state["retry_counts"].get(key, 0)
    if retry_count >= Config.MAX_RETRIES:
        state["extraction_status"][key] = "failed"
        state["errors"].append(f"{key}: Max retries exceeded")
        print(f"❌ [{key}] Max retries exceeded")
        return state

    try:
        # Read PDF with images if enabled
        if Config.USE_IMAGES_FOR_EXTRACTION and PDF2IMAGE_AVAILABLE:
            pdf_info = read_pdf_with_images(pdf_path)
        else:
            pdf_info = read_pdf_text_only(pdf_path)
        
        state["pdf_metadata"][key] = {
            "pageCount": pdf_info["page_count"],
            "originalFilename": pdf_info["filename"],
        }
        
        # Store images in state for potential reuse
        if "images" in pdf_info and pdf_info["images"]:
            state["pdf_images"][key] = pdf_info["images"]

        # Try image extraction first if images are available
        if pdf_info["images"] and Config.USE_IMAGES_FOR_EXTRACTION:
            print(f"📸 [{key}] Using image extraction ({len(pdf_info['images'])} pages)")
            
            # Prepare images for Gemini
            gemini_images = prepare_images_for_gemini(pdf_info["images"], max_images=16)
            
            if gemini_images:
                try:
                    response = AIModels.invoke_with_images(
                        prompt=system_prompt,
                        images=gemini_images,
                        max_retries=2
                    )
                    
                    content = response.content if isinstance(response.content, str) else str(response.content)
                    extracted = parse_llm_json(content)
                    
                    if "error" not in extracted:
                        confidence = float(extracted.get("extraction_confidence", 0.0))
                        
                        if confidence >= 0.6:
                            state["extracted_data"][key] = extracted
                            state["extraction_status"][key] = "success"
                            print(f"✅ [{key}] Image extraction successful (confidence: {confidence:.2f})")
                            return state
                        else:
                            print(f"⚠️ [{key}] Low confidence from images ({confidence:.2f}), trying text fallback...")
                    else:
                        print(f"⚠️ [{key}] Image extraction failed, trying text fallback...")
                        
                except Exception as img_error:
                    print(f"⚠️ [{key}] Image extraction error: {str(img_error)[:100]}, trying text fallback...")
        
        # Text extraction (fallback or primary)
        print(f"📝 [{key}] Using text extraction")
        text = pdf_info["text"]
        
        # Increase text limit for bank statements and ITRs
        text_limit = 12000 if key in ["bank_statement_6m", "itr_1", "itr_2", "itr_3"] else 6000
        
        model = AIModels.get_gemini_text()
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=text[:text_limit]),
        ]

        response = AIModels.invoke_with_retry(model, messages, max_retries=2)
        content = response.content if isinstance(response.content, str) else str(response.content)
        extracted = parse_llm_json(content)

        if "error" in extracted:
            state["retry_counts"][key] = retry_count + 1
            state["extraction_status"][key] = "pending"
            state["errors"].append(f"{key}: Parse error - {extracted.get('error')}")
            return state

        confidence = float(extracted.get("extraction_confidence", 0.0))

        # Lower confidence threshold for acceptance
        if confidence < 0.6:
            state["retry_counts"][key] = retry_count + 1
            state["extraction_status"][key] = "pending"
            state["errors"].append(f"{key}: Low confidence ({confidence:.2f}), retrying...")
            print(f"⚠️ [{key}] Low confidence {confidence:.2f}, retry {retry_count + 1}/{Config.MAX_RETRIES}")
        else:
            state["extracted_data"][key] = extracted
            state["extraction_status"][key] = "success"
            print(f"✅ [{key}] Extraction successful (confidence: {confidence:.2f})")

    except Exception as e:
        state["retry_counts"][key] = retry_count + 1
        state["extraction_status"][key] = "pending"
        error_msg = str(e)[:200]  # Limit error message length
        state["errors"].append(f"{key}: {error_msg}")
        print(f"❌ [{key}] Error: {error_msg}")

    return state

# =============================================================================
# PARALLEL EXTRACTION NODE (UPDATED)
# =============================================================================
def parallel_extraction_node(state: CoBorrowerFinancialState) -> CoBorrowerFinancialState:
    """
    Extract ALL documents in parallel using ThreadPoolExecutor
    """
    print("\n" + "="*80)
    print("🚀 PARALLEL EXTRACTION STARTED")
    print("="*80)

    # Define all extraction tasks
    extraction_tasks = [
        (FinancialDocType.SALARY_SLIP_1, SALARY_SLIP_PROMPT),
        (FinancialDocType.SALARY_SLIP_2, SALARY_SLIP_PROMPT),
        (FinancialDocType.SALARY_SLIP_3, SALARY_SLIP_PROMPT),
        (FinancialDocType.ITR_1, ITR_PROMPT),
        (FinancialDocType.ITR_2, ITR_PROMPT),
        (FinancialDocType.ITR_3, ITR_PROMPT),
        (FinancialDocType.FORM16, FORM16_PROMPT),
        (FinancialDocType.BANK_STATEMENT_6M, BANK_STATEMENT_PROMPT),
    ]

    def extract_single_doc(doc_type, prompt):
        """Extract a single document (thread-safe)"""
        # Create a local copy of state for this thread
        local_state = {
            "pdfs": state["pdfs"],
            "pdf_metadata": state.get("pdf_metadata", {}),
            "pdf_images": state.get("pdf_images", {}),
            "extracted_data": state.get("extracted_data", {}),
            "retry_counts": state.get("retry_counts", {}),
            "extraction_status": state.get("extraction_status", {}),
            "verification_result": state.get("verification_result", {}),
            "final_json": state.get("final_json", {}),
            "status": state.get("status", "processing"),
            "errors": []
        }

        result = run_extractor_for_doc_type(local_state, doc_type, prompt)
        return doc_type.value, result

    # Use ThreadPoolExecutor for parallel extraction
    # Limit to 3 concurrent threads to avoid overwhelming the API
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(extract_single_doc, doc_type, prompt): doc_type.value
            for doc_type, prompt in extraction_tasks
        }

        for future in as_completed(futures):
            doc_key = futures[future]
            try:
                doc_key, result = future.result()
                # Merge results back into main state
                state["pdf_metadata"].update(result.get("pdf_metadata", {}))
                state["pdf_images"].update(result.get("pdf_images", {}))
                state["extracted_data"].update(result.get("extracted_data", {}))
                state["retry_counts"].update(result.get("retry_counts", {}))
                state["extraction_status"].update(result.get("extraction_status", {}))
                if result.get("errors"):
                    state["errors"].extend(result["errors"])
            except Exception as e:
                print(f"❌ Error in parallel extraction for {doc_key}: {str(e)}")
                state["errors"].append(f"{doc_key}: Exception in parallel execution - {str(e)}")

    print("\n" + "="*80)
    print("✅ PARALLEL EXTRACTION COMPLETED")
    print("="*80)

    # Check if any documents need retry
    pending_docs = [k for k, v in state["extraction_status"].items() if v == "pending"]
    if pending_docs:
        print(f"⚠️ Documents needing retry: {pending_docs}")

    return state

# =============================================================================
# RETRY NODE (for documents that failed first extraction)
# =============================================================================
def retry_failed_extractions(state: CoBorrowerFinancialState) -> CoBorrowerFinancialState:
    """Retry documents that failed in parallel extraction"""
    pending_docs = [
        (k, v) for k, v in state["extraction_status"].items() 
        if v == "pending" and state["retry_counts"].get(k, 0) < Config.MAX_RETRIES
    ]

    if not pending_docs:
        print("\n✅ No documents need retry")
        return state

    print(f"\n🔄 Retrying {len(pending_docs)} failed documents...")

    # Map doc types to prompts
    prompt_map = {
        FinancialDocType.SALARY_SLIP_1.value: SALARY_SLIP_PROMPT,
        FinancialDocType.SALARY_SLIP_2.value: SALARY_SLIP_PROMPT,
        FinancialDocType.SALARY_SLIP_3.value: SALARY_SLIP_PROMPT,
        FinancialDocType.ITR_1.value: ITR_PROMPT,
        FinancialDocType.ITR_2.value: ITR_PROMPT,
        FinancialDocType.ITR_3.value: ITR_PROMPT,
        FinancialDocType.FORM16.value: FORM16_PROMPT,
        FinancialDocType.BANK_STATEMENT_6M.value: BANK_STATEMENT_PROMPT,
    }

    for doc_key, status in pending_docs:
        doc_type = FinancialDocType(doc_key)
        prompt = prompt_map[doc_key]
        state = run_extractor_for_doc_type(state, doc_type, prompt)

    return state

# =============================================================================
# CONDITIONAL EDGE FUNCTION
# =============================================================================
def should_retry(state: CoBorrowerFinancialState) -> str:
    """Determine if we should retry or move to verification"""
    pending_docs = [
        k for k, v in state["extraction_status"].items() 
        if v == "pending" and state["retry_counts"].get(k, 0) < Config.MAX_RETRIES
    ]

    if pending_docs:
        return "retry"
    return "verification"

# =============================================================================
# FINANCIAL VERIFICATION (UNCHANGED)
# =============================================================================
def financial_verification(state: CoBorrowerFinancialState) -> CoBorrowerFinancialState:
    print("\n🔐 FINANCIAL VERIFICATION: Aggregating metrics...")

    data = state["extracted_data"]

    # Salary metrics
    slip_keys = [
        FinancialDocType.SALARY_SLIP_1.value,
        FinancialDocType.SALARY_SLIP_2.value,
        FinancialDocType.SALARY_SLIP_3.value,
    ]

    net_salaries = []
    for k in slip_keys:
        slip = data.get(k) or {}
        if isinstance(slip.get("netSalary"), (int, float)):
            net_salaries.append(float(slip["netSalary"]))

    avg_monthly_salary = sum(net_salaries) / len(net_salaries) if net_salaries else 0.0

    # ITR metrics
    itr_keys = [
        FinancialDocType.ITR_1.value,
        FinancialDocType.ITR_2.value,
        FinancialDocType.ITR_3.value,
    ]

    itr_incomes = []
    for k in itr_keys:
        itr = data.get(k) or {}
        if isinstance(itr.get("totalIncome"), (int, float)):
            itr_incomes.append(float(itr["totalIncome"]))

    avg_itr_annual_income = sum(itr_incomes) / len(itr_incomes) if itr_incomes else 0.0

    # Bank metrics
    bank = data.get(FinancialDocType.BANK_STATEMENT_6M.value) or {}
    avg_monthly_balance = float(bank.get("averageMonthlyBalance") or 0.0)

    total_emi_observed = 0.0
    if isinstance(bank.get("totalEmiObserved"), (int, float)):
        total_emi_observed = float(bank["totalEmiObserved"])
    else:
        monthly_list = bank.get("monthlyData") or []
        for m in monthly_list:
            if isinstance(m.get("emiPayments"), (int, float)):
                total_emi_observed += float(m["emiPayments"])

    # Aggregate metrics
    avg_monthly_income = avg_monthly_salary or (avg_itr_annual_income / 12.0 if avg_itr_annual_income else 0.0)
    estimated_annual_income = max(avg_monthly_salary * 12.0, avg_itr_annual_income)
    total_existing_emi = total_emi_observed / 6.0 if total_emi_observed else 0.0
    foir = total_existing_emi / avg_monthly_income if avg_monthly_income > 0 else 0.0

    income_source = "salary" if avg_monthly_salary > 0 else "other_or_unknown"
    salary_consistency = (bank.get("salaryConsistency") or "").lower()

    if salary_consistency in ["stable", "regular"]:
        income_stability = "stable"
    elif salary_consistency in ["variable", "irregular"]:
        income_stability = "variable"
    else:
        income_stability = "unknown"

    # Completeness
    extraction_status = state.get("extraction_status", {})
    salary_slip_count = sum(1 for k in slip_keys if extraction_status.get(k) == "success")
    itr_years_covered = sum(1 for k in itr_keys if extraction_status.get(k) == "success")
    form16_years_covered = 1 if extraction_status.get(FinancialDocType.FORM16.value) == "success" else 0
    bank_pages = state["pdf_metadata"].get(FinancialDocType.BANK_STATEMENT_6M.value, {}).get("pageCount", 0)

    document_completeness = {
        "salarySlipCount": salary_slip_count,
        "bankStatementPageCount": bank_pages,
        "itrYearsCovered": itr_years_covered,
        "form16YearsCovered": form16_years_covered,
        "hasBusinessProof": False,
    }

    financial_summary = {
        "avgMonthlySalary": round(avg_monthly_salary, 2),
        "avgMonthlyIncome": round(avg_monthly_income, 2),
        "totalExistingEmi": round(total_existing_emi, 2),
        "estimatedAnnualIncome": round(estimated_annual_income, 2),
        "foir": round(foir, 4),
        "incomeSource": income_source,
        "incomeStability": income_stability,
        "documentCompleteness": document_completeness,
        "lastUpdated": None,
    }

    # Verification status
    issues = []
    warnings = []

    if salary_slip_count < 3:
        warnings.append(f"Only {salary_slip_count}/3 salary slips extracted successfully.")
    if itr_years_covered < 2:
        warnings.append(f"Only {itr_years_covered}/3 ITR years extracted successfully.")
    if bank_pages < 6:
        warnings.append(f"Bank statement has only {bank_pages} pages.")
    if foir > 0.7:
        issues.append(f"High FOIR ({foir:.2%}) detected.")

    verification_status = "approved" if not issues else "needs_review"

    state["verification_result"] = {
        "verification_status": verification_status,
        "confidence_score": 0.9,
        "issues": issues,
        "warnings": warnings,
        "financial_summary": financial_summary,
    }

    print(f"✅ VERIFICATION COMPLETE - status={verification_status}, FOIR={foir:.2%}, avgIncome=₹{avg_monthly_income:.2f}")

    return state

# =============================================================================
# FINAL STRUCTURE BUILDER (UNCHANGED)
# =============================================================================
def build_final_structure(state: CoBorrowerFinancialState) -> CoBorrowerFinancialState:
    print("\n📦 FINAL STRUCTURE: Building financialInfo JSON...")

    data = state["extracted_data"]
    pdfs = state["pdfs"]
    meta = state["pdf_metadata"]
    verification = state.get("verification_result", {})
    fin_summary = verification.get("financial_summary", {})

    # Salary slips
    def build_salary_slip(key: str) -> Dict[str, Any]:
        src = data.get(key) or {}
        return {
            "month": src.get("month"),
            "year": src.get("year"),
            "grossSalary": src.get("grossSalary"),
            "netSalary": src.get("netSalary"),
            "basicSalary": src.get("basicSalary"),
            "hra": src.get("hra"),
            "allowances": src.get("allowances"),
            "deductions": {
                "pf": (src.get("deductions") or {}).get("pf"),
                "tax": (src.get("deductions") or {}).get("tax"),
                "insurance": (src.get("deductions") or {}).get("insurance"),
                "other": (src.get("deductions") or {}).get("other"),
            },
            "employerName": src.get("employerName"),
            "documentUrls": [pdfs.get(key, "")] if pdfs.get(key) else [],
        }

    salary_slips = []
    for k in [
        FinancialDocType.SALARY_SLIP_1.value,
        FinancialDocType.SALARY_SLIP_2.value,
        FinancialDocType.SALARY_SLIP_3.value,
    ]:
        if k in data and "error" not in data[k] and "note" not in data[k]:
            salary_slips.append(build_salary_slip(k))

    # ITR data
    def build_itr(key: str) -> Dict[str, Any]:
        src = data.get(key) or {}
        return {
            "assessmentYear": src.get("assessmentYear"),
            "financialYear": src.get("financialYear"),
            "totalIncome": src.get("totalIncome"),
            "taxPaid": src.get("taxPaid"),
            "filingDate": src.get("filingDate"),
            "incomeFromSalary": src.get("incomeFromSalary"),
            "incomeFromBusiness": src.get("incomeFromBusiness"),
            "incomeFromOtherSources": src.get("incomeFromOtherSources"),
            "documentUrls": [pdfs.get(key, "")] if pdfs.get(key) else [],
            "acknowledged": src.get("acknowledged", True),
            "acknowledgmentNumber": src.get("acknowledgmentNumber"),
        }

    itr_data = []
    for k in [
        FinancialDocType.ITR_1.value,
        FinancialDocType.ITR_2.value,
        FinancialDocType.ITR_3.value,
    ]:
        if k in data and "error" not in data[k]:
            itr_data.append(build_itr(k))

    # Form 16
    form16_data = []
    form_key = FinancialDocType.FORM16.value
    if form_key in data and "note" not in data[form_key] and "error" not in data[form_key]:
        src = data[form_key]
        form16_data.append({
            "financialYear": src.get("financialYear"),
            "employerName": src.get("employerName"),
            "grossSalary": src.get("grossSalary"),
            "standardDeduction": src.get("standardDeduction"),
            "taxableIncome": src.get("taxableIncome"),
            "tdsDeducted": src.get("tdsDeducted"),
            "panNumber": src.get("panNumber"),
            "documentUrls": [pdfs.get(form_key, "")] if pdfs.get(form_key) else [],
        })

    # Bank statement
    bank_key = FinancialDocType.BANK_STATEMENT_6M.value
    bank_src = data.get(bank_key) or {}
    bank_meta = meta.get(bank_key) or {}

    bank_statement_obj = {
        "accountNumber": bank_src.get("accountNumber"),
        "bankName": bank_src.get("bankName"),
        "ifscCode": bank_src.get("ifscCode"),
        "accountType": bank_src.get("accountType"),
        "statementPeriod": {
            "from": (bank_src.get("statementPeriod") or {}).get("from"),
            "to": (bank_src.get("statementPeriod") or {}).get("to"),
        },
        "monthlyData": bank_src.get("monthlyData") or [],
        "averageMonthlyBalance": bank_src.get("averageMonthlyBalance"),
        "totalEmiObserved": bank_src.get("totalEmiObserved"),
        "salaryConsistency": bank_src.get("salaryConsistency"),
        "documentUrls": [pdfs.get(bank_key, "")] if pdfs.get(bank_key) else [],
        "pageCount": bank_meta.get("pageCount"),
    }

    # Personal info
    primary_employer = salary_slips[0].get("employerName") if salary_slips else None
    personal_info = {
        "employeeId": None,
        "companyName": primary_employer,
        "designation": None,
        "name": None,
    }

    # All documents
    all_documents = []
    type_map = {
        FinancialDocType.SALARY_SLIP_1.value: "salary_slip",
        FinancialDocType.SALARY_SLIP_2.value: "salary_slip",
        FinancialDocType.SALARY_SLIP_3.value: "salary_slip",
        FinancialDocType.ITR_1.value: "itr",
        FinancialDocType.ITR_2.value: "itr",
        FinancialDocType.ITR_3.value: "itr",
        FinancialDocType.FORM16.value: "form_16",
        FinancialDocType.BANK_STATEMENT_6M.value: "bank_statement",
    }

    for key, path in pdfs.items():
        if not path:
            continue
        doc_type = type_map.get(key, "other")
        m = meta.get(key, {})
        all_documents.append({
            "documentType": doc_type,
            "documentUrls": [path],
            "documentMetadata": {
                "uploadedAt": None,
                "pageCount": m.get("pageCount"),
                "fileSize": None,
                "originalFilename": m.get("filename") or m.get("originalFilename"),
            },
        })

    financial_info = {
        "personalInfo": personal_info,
        "salarySlips": salary_slips,
        "bankStatement": bank_statement_obj,
        "itrData": itr_data,
        "form16Data": form16_data,
        "businessProof": {
            "businessName": None,
            "gstNumber": None,
            "registrationNumber": None,
            "annualRevenue": None,
            "annualProfit": None,
            "businessType": None,
            "documentUrls": [],
        },
        "financialSummary": fin_summary,
        "allDocuments": all_documents,
    }

    state["final_json"] = financial_info

    # Determine final status
    required_keys = [
        FinancialDocType.SALARY_SLIP_1.value,
        FinancialDocType.SALARY_SLIP_2.value,
        FinancialDocType.SALARY_SLIP_3.value,
        FinancialDocType.ITR_1.value,
        FinancialDocType.ITR_2.value,
        FinancialDocType.ITR_3.value,
        FinancialDocType.BANK_STATEMENT_6M.value,
    ]

    status_map = state.get("extraction_status", {})
    failed_required = [k for k in required_keys if status_map.get(k) == "failed"]

    if failed_required:
        state["status"] = "partial"
        print(f"⚠️ FINAL STATUS: partial, failed docs={failed_required}")
    else:
        state["status"] = "completed"
        print("✅ FINAL STATUS: completed")

    return state

# =============================================================================
# GRAPH CONSTRUCTION WITH PARALLEL PROCESSING
# =============================================================================
def build_coborrower_financial_graph() -> StateGraph:
    """Build optimized graph with parallel extraction"""
    workflow = StateGraph(CoBorrowerFinancialState)

    # Add nodes
    workflow.add_node("parallel_extraction", parallel_extraction_node)
    workflow.add_node("retry_extraction", retry_failed_extractions)
    workflow.add_node("verification", financial_verification)
    workflow.add_node("final", build_final_structure)

    # Set entry point
    workflow.set_entry_point("parallel_extraction")

    # Conditional edges
    workflow.add_conditional_edges(
        "parallel_extraction",
        should_retry,
        {
            "retry": "retry_extraction",
            "verification": "verification",
        }
    )

    workflow.add_conditional_edges(
        "retry_extraction",
        should_retry,
        {
            "retry": "retry_extraction",  # Can retry again if still pending
            "verification": "verification",
        }
    )

    workflow.add_edge("verification", "final")
    workflow.add_edge("final", END)

    return workflow.compile()

# =============================================================================
# MAIN ENTRY FUNCTION (UPDATED INITIAL STATE)
# =============================================================================
def process_coborrower_financial_docs(pdf_paths: Dict[str, str]) -> Dict[str, Any]:
    """
    Process co-borrower financial documents with parallel extraction

    Args:
        pdf_paths: Dict mapping document types to file paths

    Returns:
        Dict with extraction results and financial info
    """
    print("=" * 80)
    print("🚀 CoBorrower FINANCIAL DOCUMENT PROCESSING - PARALLEL MODE")
    print("=" * 80)
    
    print(f"📸 Image extraction: {'ENABLED' if Config.USE_IMAGES_FOR_EXTRACTION else 'DISABLED'}")

    # Filter valid paths
    valid_pdfs = {k: v for k, v in pdf_paths.items() if v and str(v).strip()}

    required_docs = [
        FinancialDocType.SALARY_SLIP_1.value,
        FinancialDocType.SALARY_SLIP_2.value,
        FinancialDocType.SALARY_SLIP_3.value,
        FinancialDocType.ITR_1.value,
        FinancialDocType.ITR_2.value,
        FinancialDocType.ITR_3.value,
        FinancialDocType.BANK_STATEMENT_6M.value,
    ]

    missing = [doc for doc in required_docs if doc not in valid_pdfs]
    if missing:
        error_msg = f"Missing required financial documents: {', '.join(missing)}"
        print(f"\n❌ {error_msg}")
        return {
            "status": "failed",
            "error": error_msg,
            "errors": [error_msg],
        }

    # Initialize state
    initial_state = {
        "pdfs": valid_pdfs,
        "pdf_metadata": {},
        "pdf_images": {},  # NEW: Initialize image storage
        "extracted_data": {},
        "retry_counts": {doc: 0 for doc in valid_pdfs.keys()},
        "extraction_status": {doc: "pending" for doc in valid_pdfs.keys()},
        "verification_result": {},
        "final_json": {},
        "status": "processing",
        "errors": [],
    }

    print(f"\n📋 Financial PDFs to process: {list(valid_pdfs.keys())}")
    print(f"🔧 Max retries per document: {Config.MAX_RETRIES}")
    print(f"⚡ Parallel execution: 3 concurrent threads")
    print("\n" + "=" * 80)

    try:
        graph = build_coborrower_financial_graph()
        final_state = graph.invoke(initial_state)

        result = {
            "status": final_state.get("status"),
            "financialInfo": final_state.get("final_json", {}),
            "verification": final_state.get("verification_result", {}),
            "extracted_data": final_state.get("extracted_data", {}),
            "extraction_status": final_state.get("extraction_status", {}),
            "retry_counts": final_state.get("retry_counts", {}),
            "pdf_images_available": list(final_state.get("pdf_images", {}).keys()),  # NEW
            "errors": final_state.get("errors", []),
            "summary": {
                "total_documents": len(valid_pdfs),
                "successful_extractions": sum(
                    1 for status in final_state.get("extraction_status", {}).values()
                    if status == "success"
                ),
                "failed_extractions": sum(
                    1 for status in final_state.get("extraction_status", {}).values()
                    if status == "failed"
                ),
                "total_retries": sum(final_state.get("retry_counts", {}).values()),
            },
        }

        print("\n" + "=" * 80)
        print("✅ CoBorrower FINANCIAL PROCESSING COMPLETE")
        print("=" * 80)
        print(f"Status: {result['status']}")
        print(f"Successful: {result['summary']['successful_extractions']}/{result['summary']['total_documents']}")
        print(f"Failed: {result['summary']['failed_extractions']}")
        print(f"Total Retries: {result['summary']['total_retries']}")
        
        if result['pdf_images_available']:
            print(f"Images used for: {', '.join(result['pdf_images_available'])}")

        if result["errors"]:
            print(f"\n⚠️ Errors encountered: {len(result['errors'])}")
            for e in result["errors"][:10]:
                print(f"   - {e}")

        return result

    except Exception as e:
        import traceback
        print(f"\n❌ CRITICAL ERROR: {str(e)}")
        traceback.print_exc()
        return {
            "status": "failed",
            "error": str(e),
            "financialInfo": {},
            "extracted_data": {},
            "errors": [str(e)],
        }

# =============================================================================
# MAIN EXECUTION
# =============================================================================
if __name__ == "__main__":
    # Check dependencies
    if Config.USE_IMAGES_FOR_EXTRACTION and not PDF2IMAGE_AVAILABLE:
        print("\n⚠️ IMPORTANT: To use image extraction, install:")
        print("   pip install pdf2image pillow")
        if os.name == 'nt':
            print("\n   Also install poppler for Windows:")
            print("   Download from: https://github.com/oschwartz10612/poppler-windows/releases")
            print("   Extract to: C:\\Program Files\\poppler")
    
    # Example local test
    sample_pdfs = {
        "salary_slip_1": r"C:\Users\sansk\OneDrive\Desktop\loan\loanbackend-2\backendv2\Anil Shah- Father\salaryslip1.pdf",
        "salary_slip_2": r"C:\Users\sansk\OneDrive\Desktop\loan\loanbackend-2\backendv2\Anil Shah- Father\salaryslip2.pdf",
        "salary_slip_3": r"C:\Users\sansk\OneDrive\Desktop\loan\loanbackend-2\backendv2\Anil Shah- Father\salaryslip3.pdf",
        "itr_1": r"C:\Users\sansk\OneDrive\Desktop\loan\loanbackend-2\backendv2\Anil Shah- Father\itr1.pdf",
        "itr_2": r"C:\Users\sansk\OneDrive\Desktop\loan\loanbackend-2\backendv2\Anil Shah- Father\itr2.pdf",
        "itr_3": r"C:\Users\sansk\OneDrive\Desktop\loan\loanbackend-2\backendv2\Anil Shah- Father\itr3.pdf",
        "form_16": "",  # optional
        "bank_statement_6m": r"C:\Users\sansk\OneDrive\Desktop\loan\loanbackend-2\backendv2\Anil Shah- Father\bankstatement.pdf",
    }

    result = process_coborrower_financial_docs(sample_pdfs)

    with open("coborrower_financial_result.json", "w") as f:
        json.dump(result, f, indent=2)

    print("\n💾 Results saved to coborrower_financial_result.json")