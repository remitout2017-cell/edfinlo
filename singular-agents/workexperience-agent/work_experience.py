"""
Work Experience Extraction & Verification Engine
- Parallel processing with LangGraph and multi-agent system
- Image-based extraction using Gemini Vision
- Multi-threaded verification with Groq
- Rate limiting and error handling
"""

import io
import os
import json
import base64
import time
import logging
import threading
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple, TypedDict
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from dataclasses import dataclass, asdict
import numpy as np
from PIL import Image
import pdfplumber
from pdf2image import convert_from_path, convert_from_bytes
import aiohttp
import async_timeout
import redis
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv

load_dotenv()

# =========================
# Configuration & Constants
# =========================


class Config:
    """Configuration for work experience processing"""

    # API Keys
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

    # Model Settings
    EXTRACTION_MODEL = os.getenv(
        "WORK_EXTRACTION_MODEL", "gemini-2.5-flash")
    VERIFICATION_MODEL = os.getenv(
        "WORK_VERIFICATION_MODEL", "groq/compound")

    # Processing Settings
    MAX_WORKERS = int(
        os.getenv("MAX_WORKERS", min(32, (os.cpu_count() or 1) * 4)))
    MAX_THREADS = int(
        os.getenv("MAX_THREADS", min(64, (os.cpu_count() or 1) * 8)))
    MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
    TIMEOUT_SECONDS = int(os.getenv("TIMEOUT_SECONDS", "30"))

    # Image Processing
    USE_IMAGE_EXTRACTION = os.getenv(
        "USE_IMAGE_EXTRACTION", "true").lower() == "true"
    IMAGE_DPI = int(os.getenv("IMAGE_DPI", "150"))
    MAX_IMAGE_SIZE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", "10"))
    IMAGE_QUALITY = int(os.getenv("IMAGE_QUALITY", "85"))
    MAX_PAGES_PER_DOC = int(os.getenv("MAX_PAGES_PER_DOC", "20"))

    # Rate Limiting
    RATE_LIMIT_RPM = int(os.getenv("RATE_LIMIT_RPM", "15"))
    MIN_REQUEST_INTERVAL = 60.0 / RATE_LIMIT_RPM

    # Validation Rules
    MIN_SALARY = 1000
    MAX_SALARY = 10000000
    MIN_START_YEAR = 1980
    MAX_FUTURE_YEAR = datetime.now().year + 1

    @classmethod
    def validate(cls):
        """Validate configuration"""
        missing = []
        if not cls.GEMINI_API_KEY:
            missing.append("GEMINI_API_KEY")
        if not cls.GROQ_API_KEY:
            missing.append("GROQ_API_KEY")

        if missing:
            raise ValueError(
                f"Missing required environment variables: {', '.join(missing)}")

        logger.info(f"✅ Work Experience Config validated")
        logger.info(
            f"📊 Max Workers: {cls.MAX_WORKERS}, Max Threads: {cls.MAX_THREADS}")
        logger.info(
            f"📸 Image Extraction: {'ENABLED' if cls.USE_IMAGE_EXTRACTION else 'DISABLED'}")


# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =========================
# Data Models
# =========================


class EmploymentType(str, Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERNSHIP_PAID = "internship_paid"
    INTERNSHIP_UNPAID = "internship_unpaid"
    FREELANCE = "freelance"
    VOLUNTEER = "volunteer"
    TEMPORARY = "temporary"


@dataclass
class ExtractedWorkData:
    """Extracted work experience data"""
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    employment_type: EmploymentType = EmploymentType.FULL_TIME
    start_date: Optional[str] = None  # DD/MM/YYYY
    end_date: Optional[str] = None  # DD/MM/YYYY
    currently_working: bool = False
    is_paid: bool = True
    stipend_amount: Optional[float] = None
    salary_slips: List[str] = None
    extraction_confidence: float = 0.0
    document_quality: float = 0.0
    notes: Optional[str] = None  # ✅ ADDED THIS FIELD

    def __post_init__(self):
        if self.salary_slips is None:
            self.salary_slips = []


@dataclass
class VerificationResult:
    """Verification result"""
    valid: bool = False
    confidence: str = "low"  # high, medium, low
    reason: str = ""
    issues: List[str] = None
    warnings: List[str] = None

    def __post_init__(self):
        if self.issues is None:
            self.issues = []
        if self.warnings is None:
            self.warnings = []


@dataclass
class DocumentInfo:
    """Document metadata and content"""
    path: str
    filename: str
    extension: str
    size_mb: float
    page_count: int = 0
    text_content: str = ""
    images: List[str] = None  # base64 encoded
    quality_score: float = 0.0

    def __post_init__(self):
        if self.images is None:
            self.images = []


@dataclass
class ProcessingState:
    """LangGraph state for processing"""
    document_infos: List[DocumentInfo] = None
    extracted_data: List[ExtractedWorkData] = None
    verification_results: List[VerificationResult] = None
    combined_result: Dict[str, Any] = None
    errors: List[str] = None
    processing_time: float = 0.0
    status: str = "pending"

    def __post_init__(self):
        if self.document_infos is None:
            self.document_infos = []
        if self.extracted_data is None:
            self.extracted_data = []
        if self.verification_results is None:
            self.verification_results = []
        if self.errors is None:
            self.errors = []
        if self.combined_result is None:
            self.combined_result = {}

# =========================
# Rate Limiter
# =========================


class RateLimiter:
    """Thread-safe rate limiter for API calls"""

    def __init__(self, requests_per_minute: int):
        self.requests_per_minute = requests_per_minute
        self.min_interval = 60.0 / requests_per_minute
        self.last_request_time = 0.0
        self.lock = threading.Lock()

    def acquire(self):
        """Wait for permission to make a request"""
        with self.lock:
            current_time = time.time()
            time_since_last = current_time - self.last_request_time

            if time_since_last < self.min_interval:
                sleep_time = self.min_interval - time_since_last
                logger.debug(f"⏳ Rate limiting: waiting {sleep_time:.2f}s")
                time.sleep(sleep_time)

            self.last_request_time = time.time()
            return True

# =========================
# Image Processing
# =========================


class ImageProcessor:
    """Advanced image processing with optimization"""

    @staticmethod
    def compress_image(image_data: bytes, max_size_mb: int = 5) -> bytes:
        """Compress image to target size"""
        try:
            img = Image.open(io.BytesIO(image_data))

            current_size_mb = len(image_data) / (1024 * 1024)
            if current_size_mb <= max_size_mb:
                return image_data

            target_quality = int((max_size_mb / current_size_mb) * 90)
            target_quality = max(60, min(95, target_quality))

            output = io.BytesIO()
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')

            img.save(output, format='JPEG',
                     quality=target_quality, optimize=True)
            compressed = output.getvalue()

            logger.info(
                f"📉 Image compressed: {current_size_mb:.2f}MB → {len(compressed)/(1024*1024):.2f}MB")
            return compressed

        except Exception as e:
            logger.warning(f"⚠️ Image compression failed: {str(e)}")
            return image_data

    @staticmethod
    def pdf_to_images(pdf_path: str, max_pages: int = 20, dpi: int = 150) -> List[bytes]:
        """Convert PDF pages to optimized images"""
        try:
            images = convert_from_path(
                pdf_path,
                dpi=dpi,
                first_page=1,
                last_page=max_pages
            )

            image_data = []
            for i, img in enumerate(images):
                if img.mode != 'RGB':
                    img = img.convert('RGB')

                buffer = io.BytesIO()
                img.save(buffer, format='JPEG', quality=85, optimize=True)
                compressed = ImageProcessor.compress_image(buffer.getvalue())
                image_data.append(compressed)

            logger.info(f"✅ Converted {len(image_data)} PDF pages to images")
            return image_data

        except Exception as e:
            logger.error(f"❌ PDF to image conversion failed: {str(e)}")
            return []  # ✅ Return empty list instead of None

    @staticmethod
    def analyze_image_quality(image_data: bytes) -> float:
        """Analyze image quality (0-1 score)"""
        try:
            img = Image.open(io.BytesIO(image_data))
            width, height = img.size
            min_dimension = min(width, height)

            resolution_score = min(0.5, min_dimension / 1000)
            size_mb = len(image_data) / (1024 * 1024)
            size_score = 0.3 if size_mb > 0.1 else size_mb * 3
            color_score = 0.2 if img.mode == 'RGB' else 0.1

            total_score = resolution_score + size_score + color_score
            return min(1.0, total_score)

        except Exception as e:
            logger.warning(f"⚠️ Image quality analysis failed: {str(e)}")
            return 0.3

# =========================
# Document Loader
# =========================


class DocumentLoader:
    """Load and preprocess documents"""

    @staticmethod
    def load_document(file_path: str) -> DocumentInfo:
        """Load document and extract metadata"""
        try:
            path = Path(file_path)
            if not path.exists():
                raise FileNotFoundError(f"Document not found: {file_path}")

            size_mb = path.stat().st_size / (1024 * 1024)
            extension = path.suffix.lower()

            doc_info = DocumentInfo(
                path=str(path),
                filename=path.name,
                extension=extension,
                size_mb=size_mb
            )

            if extension == '.pdf':
                doc_info = DocumentLoader._process_pdf(doc_info)
            elif extension in ['.jpg', '.jpeg', '.png']:
                doc_info = DocumentLoader._process_image(doc_info)
            else:
                raise ValueError(f"Unsupported file type: {extension}")

            doc_info.quality_score = DocumentLoader._calculate_quality(
                doc_info)

            logger.info(f"✅ Loaded document: {doc_info.filename} "
                        f"(pages: {doc_info.page_count}, quality: {doc_info.quality_score:.2f})")

            return doc_info

        except Exception as e:
            logger.error(f"❌ Failed to load document {file_path}: {str(e)}")
            raise

    @staticmethod
    def _process_pdf(doc_info: DocumentInfo) -> DocumentInfo:
        """Process PDF document"""
        with pdfplumber.open(doc_info.path) as pdf:
            pages_text = []
            for page in pdf.pages:
                text = page.extract_text() or ""
                pages_text.append(text)

            doc_info.text_content = "\n\n".join(pages_text)
            doc_info.page_count = len(pdf.pages)

        if Config.USE_IMAGE_EXTRACTION and doc_info.page_count <= Config.MAX_PAGES_PER_DOC:
            images = ImageProcessor.pdf_to_images(
                doc_info.path,
                max_pages=Config.MAX_PAGES_PER_DOC,
                dpi=Config.IMAGE_DPI
            )
            # ✅ Check if images list is not empty before processing
            if images:
                doc_info.images = [base64.b64encode(
                    img).decode('utf-8') for img in images]

        return doc_info

    @staticmethod
    def _process_image(doc_info: DocumentInfo) -> DocumentInfo:
        """Process image document"""
        with open(doc_info.path, 'rb') as f:
            image_data = f.read()

        if len(image_data) > Config.MAX_IMAGE_SIZE_MB * 1024 * 1024:
            image_data = ImageProcessor.compress_image(
                image_data, Config.MAX_IMAGE_SIZE_MB)

        doc_info.images = [base64.b64encode(image_data).decode('utf-8')]
        doc_info.page_count = 1

        return doc_info

    @staticmethod
    def _calculate_quality(doc_info: DocumentInfo) -> float:
        """Calculate document quality score"""
        score = 0.0

        if doc_info.size_mb < 10:
            score += 0.3
        elif doc_info.size_mb < 50:
            score += 0.2
        else:
            score += 0.1

        if doc_info.page_count <= 10:
            score += 0.3
        elif doc_info.page_count <= 20:
            score += 0.2
        else:
            score += 0.1

        if doc_info.images:
            quality_scores = [ImageProcessor.analyze_image_quality(
                base64.b64decode(img)) for img in doc_info.images[:3]]
            avg_image_quality = np.mean(
                quality_scores) if quality_scores else 0.3
            score += avg_image_quality * 0.4

        return min(1.0, score)

# =========================
# AI Models with Connection Pool
# =========================


class AIModelPool:
    """Thread-safe AI model pool"""
    _instance = None
    _lock = threading.Lock()
    _gemini_pool: List[ChatGoogleGenerativeAI] = []
    _groq_pool: List[ChatGroq] = []
    _rate_limiter = RateLimiter(Config.RATE_LIMIT_RPM)

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def get_gemini(cls) -> ChatGoogleGenerativeAI:
        """Get Gemini model instance"""
        with cls._lock:
            if not cls._gemini_pool:
                for _ in range(min(Config.MAX_THREADS, 10)):
                    cls._gemini_pool.append(
                        ChatGoogleGenerativeAI(
                            google_api_key=Config.GEMINI_API_KEY,
                            model=Config.EXTRACTION_MODEL,
                            temperature=0.1,
                            max_output_tokens=4096,
                            timeout=Config.TIMEOUT_SECONDS,
                        )
                    )
            pool_size = len(cls._gemini_pool)
            # ✅ index based on thread id modulo pool size
            index = threading.get_ident() % pool_size
            return cls._gemini_pool[index]

    @classmethod
    def get_groq(cls) -> ChatGroq:
        """Get Groq model instance"""
        with cls._lock:
            if not cls._groq_pool:
                for _ in range(min(Config.MAX_THREADS, 5)):
                    cls._groq_pool.append(
                        ChatGroq(
                            groq_api_key=Config.GROQ_API_KEY,
                            model_name=Config.VERIFICATION_MODEL,
                            temperature=0.1,
                            max_tokens=1024,
                            timeout=Config.TIMEOUT_SECONDS,
                        )
                    )
            pool_size = len(cls._groq_pool)
            # ✅ same fix here
            index = threading.get_ident() % pool_size
            return cls._groq_pool[index]

    @classmethod
    def acquire_rate_limit(cls):
        cls._rate_limiter.acquire()

# =========================
# Prompts
# =========================


# Replace EXTRACTION_PROMPT and VERIFICATION_PROMPT in work_experience.py

EXTRACTION_PROMPT = """You are an expert at extracting work experience information from employment documents.

ANALYZE THIS DOCUMENT AND EXTRACT:

1. **Company Name** - Look for:
   - Company logo or letterhead at top
   - "From:", "Company:", "Organization:" labels
   - Email domain (e.g., @bluesparkles.com → "Blue Sparkles")
   - Footer/signature company name
   - ANY company identifier

2. **Job Title/Position** - Look for:
   - "Position:", "Designation:", "Role:", "Title:"
   - "You are appointed as [TITLE]"
   - "Joining as [TITLE]"
   - Near employee name or signature

3. **Employment Type** - Determine from:
   - "Full-time", "Permanent" → full_time
   - "Part-time" → part_time
   - "Intern", "Internship" → internship_paid or internship_unpaid
   - "Contract", "Contractual" → contract
   - "Freelance" → freelance
   - Default to full_time if unclear

4. **Dates** - Look for:
   - "Date of Joining:", "Start Date:", "From:"
   - "Date of Relieving:", "Last Working Day:", "To:"
   - "Currently working", "Till date", "Present" → currentlyWorking: true
   - Format as DD/MM/YYYY (e.g., 15/03/2023)

5. **Salary/Stipend** - Look for:
   - "CTC:", "Salary:", "Stipend:", "Compensation:"
   - "Per month:", "Monthly:", "Annual:"
   - Convert annual to monthly (divide by 12)
   - Extract number only (e.g., "₹25,000" → 25000)

6. **Payment Status**:
   - Only set isPaid: false if explicitly says "unpaid" or "volunteer"
   - Otherwise assume isPaid: true

IMPORTANT RULES:
- If you see ANYTHING that looks like a company name, extract it (even partial)
- If you see ANY job title or position, extract it (even if informal)
- Date format MUST be DD/MM/YYYY
- Return null only if truly nothing found
- Set extraction_confidence based on clarity:
  * 0.9-1.0: All fields clear and readable
  * 0.7-0.9: Most fields found, some unclear
  * 0.5-0.7: Minimal info, poor quality
  * <0.5: Almost nothing extracted

RETURN ONLY THIS JSON (no markdown, no extra text):
{
  "companyName": "string or null",
  "jobTitle": "string or null",
  "employmentType": "full_time",
  "startDate": "DD/MM/YYYY or null",
  "endDate": "DD/MM/YYYY or null",
  "currentlyWorking": false,
  "isPaid": true,
  "stipendAmount": null,
  "salarySlips": [],
  "extraction_confidence": 0.85,
  "notes": "Brief explanation of what was found or missing"
}

EXAMPLE - If image shows "Blue Sparkles Ltd" letterhead and "Manager" below name:
{
  "companyName": "Blue Sparkles Ltd",
  "jobTitle": "Manager",
  "employmentType": "full_time",
  "startDate": null,
  "endDate": null,
  "currentlyWorking": false,
  "isPaid": true,
  "stipendAmount": null,
  "salarySlips": [],
  "extraction_confidence": 0.6,
  "notes": "Found company name in letterhead and job title, but no dates"
}

NOW EXTRACT FROM THE PROVIDED DOCUMENT:"""

# Remove VERIFICATION_PROMPT since we're doing programmatic verification now
# The WorkExperienceVerifier class no longer needs AI verification
# =========================
# Extraction Node (Parallel)
# =========================
# Complete fix for work_experience.py
# Replace the entire WorkExperienceExtractor class


class WorkExperienceExtractor:
    """Parallel work experience extractor with robust parsing"""

    @staticmethod
    def extract_from_document(doc_info: DocumentInfo) -> ExtractedWorkData:
        """Extract work experience from single document"""
        try:
            AIModelPool.acquire_rate_limit()
            model = AIModelPool.get_gemini()

            messages = []

            # ✅ Check if images exist and are not empty
            if doc_info.images and len(doc_info.images) > 0:
                logger.info(
                    f"📸 Using {len(doc_info.images)} image(s) for extraction")

                image_parts = []
                for idx, img_base64 in enumerate(doc_info.images[:16]):
                    # Verify image is valid base64
                    if img_base64 and len(img_base64) > 100:
                        image_parts.append({
                            "type": "image_url",
                            "image_url": f"data:image/jpeg;base64,{img_base64}"
                        })
                        logger.info(
                            f"  - Image {idx+1}: {len(img_base64)} chars")
                    else:
                        logger.warning(
                            f"  - Image {idx+1}: Invalid or too small")

                if image_parts:
                    content = [{"type": "text", "text": EXTRACTION_PROMPT}]
                    content.extend(image_parts)
                    messages = [HumanMessage(content=content)]
                else:
                    logger.warning("⚠️ No valid images to process")

            # Fallback to text if no images
            if not messages and doc_info.text_content:
                logger.info(
                    f"📝 Using text content for extraction ({len(doc_info.text_content)} chars)")
                text = doc_info.text_content[:10000]
                messages = [
                    SystemMessage(content=EXTRACTION_PROMPT),
                    HumanMessage(content=f"DOCUMENT TEXT:\n\n{text}")
                ]

            if not messages:
                logger.error("❌ No content available for extraction")
                return ExtractedWorkData(
                    extraction_confidence=0.0,
                    notes="No extractable content found in document"
                )

            # Call AI with retry logic
            max_retries = 3
            response_content = None

            for attempt in range(max_retries):
                try:
                    logger.info(
                        f"🤖 Calling Gemini (attempt {attempt + 1}/{max_retries})...")
                    response = model.invoke(messages)
                    response_content = response.content if hasattr(
                        response, 'content') else str(response)

                    logger.info(
                        f"📥 Received response: {len(response_content)} chars")
                    logger.info(
                        f"Response preview: {response_content[:300]}...")

                    if response_content and len(response_content) > 10:
                        break
                    else:
                        logger.warning(
                            f"Empty response on attempt {attempt + 1}")
                        time.sleep(1)

                except Exception as e:
                    logger.error(
                        f"API call failed on attempt {attempt + 1}: {str(e)}")
                    if attempt < max_retries - 1:
                        time.sleep(2)
                    else:
                        raise

            if not response_content:
                raise ValueError("No response from AI model after retries")

            # Parse response with multiple strategies
            extracted = WorkExperienceExtractor._parse_extraction_robust(
                response_content)

            # If still no data, try extracting from text directly
            if (not extracted.company_name and not extracted.job_title) and doc_info.text_content:
                logger.warning(
                    "⚠️ AI extraction failed, trying text-based extraction...")
                extracted = WorkExperienceExtractor._fallback_text_extraction(
                    doc_info.text_content)

            extracted.extraction_confidence *= doc_info.quality_score
            extracted.document_quality = doc_info.quality_score

            logger.info(f"✅ Extracted from {doc_info.filename}:")
            logger.info(f"   Company: '{extracted.company_name or 'NONE'}'")
            logger.info(f"   Job Title: '{extracted.job_title or 'NONE'}'")
            logger.info(
                f"   Confidence: {extracted.extraction_confidence:.2f}")

            return extracted

        except Exception as e:
            logger.error(
                f"❌ Extraction failed for {doc_info.filename}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return ExtractedWorkData(
                extraction_confidence=0.0,
                notes=f"Extraction error: {str(e)[:200]}"
            )

    @staticmethod
    def _parse_extraction_robust(response: str) -> ExtractedWorkData:
        """Parse AI response with multiple fallback strategies"""

        # Strategy 1: Find JSON block
        try:
            # Remove markdown code blocks if present
            cleaned = response.strip()
            if cleaned.startswith('```'):
                # Remove ```json or ``` at start
                cleaned = cleaned.split(
                    '\n', 1)[1] if '\n' in cleaned else cleaned[3:]
            if cleaned.endswith('```'):
                cleaned = cleaned.rsplit(
                    '\n', 1)[0] if '\n' in cleaned else cleaned[:-3]

            # Find JSON object
            start = cleaned.find('{')
            end = cleaned.rfind('}') + 1

            if start != -1 and end > start:
                json_str = cleaned[start:end]
                logger.debug(f"Attempting to parse JSON: {json_str[:200]}...")

                data = json.loads(json_str)

                return ExtractedWorkData(
                    company_name=data.get('companyName') or data.get(
                        'company_name') or None,
                    job_title=data.get('jobTitle') or data.get(
                        'job_title') or None,
                    employment_type=EmploymentType(
                        data.get('employmentType', 'full_time').lower().replace('-', '_')),
                    start_date=data.get('startDate') or data.get('start_date'),
                    end_date=data.get('endDate') or data.get('end_date'),
                    currently_working=bool(
                        data.get('currentlyWorking', False) or data.get('currently_working', False)),
                    is_paid=bool(data.get('isPaid', True)
                                 or data.get('is_paid', True)),
                    stipend_amount=data.get(
                        'stipendAmount') or data.get('stipend_amount'),
                    salary_slips=data.get('salarySlips', []) or data.get(
                        'salary_slips', []),
                    extraction_confidence=float(data.get(
                        'extraction_confidence', 0.5) or data.get('extractionConfidence', 0.5)),
                    notes=data.get('notes', '')
                )
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parsing failed: {str(e)}")
        except Exception as e:
            logger.warning(f"Parsing strategy 1 failed: {str(e)}")

        # Strategy 2: Try to extract fields directly from text
        try:
            logger.info("Trying text-based field extraction...")
            return WorkExperienceExtractor._extract_from_text(response)
        except Exception as e:
            logger.warning(f"Text extraction failed: {str(e)}")

        # Strategy 3: Return minimal data
        logger.error("All parsing strategies failed")
        return ExtractedWorkData(
            extraction_confidence=0.0,
            notes=f"Failed to parse response. Raw: {response[:200]}"
        )

    @staticmethod
    def _extract_from_text(text: str) -> ExtractedWorkData:
        """Extract fields from plain text response"""
        import re

        # Look for field patterns
        company_pattern = r'["\']?companyName["\']?\s*:\s*["\']([^"\']+)["\']'
        title_pattern = r'["\']?jobTitle["\']?\s*:\s*["\']([^"\']+)["\']'
        type_pattern = r'["\']?employmentType["\']?\s*:\s*["\']([^"\']+)["\']'
        start_pattern = r'["\']?startDate["\']?\s*:\s*["\']([^"\']+)["\']'
        confidence_pattern = r'["\']?extraction_confidence["\']?\s*:\s*([0-9.]+)'

        company = None
        title = None
        emp_type = "full_time"
        start_date = None
        confidence = 0.3

        company_match = re.search(company_pattern, text, re.IGNORECASE)
        if company_match:
            company = company_match.group(1).strip()

        title_match = re.search(title_pattern, text, re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()

        type_match = re.search(type_pattern, text, re.IGNORECASE)
        if type_match:
            emp_type = type_match.group(1).strip()

        start_match = re.search(start_pattern, text, re.IGNORECASE)
        if start_match:
            start_date = start_match.group(1).strip()

        conf_match = re.search(confidence_pattern, text, re.IGNORECASE)
        if conf_match:
            confidence = float(conf_match.group(1))

        return ExtractedWorkData(
            company_name=company,
            job_title=title,
            employment_type=EmploymentType(emp_type.lower().replace(
                '-', '_')) if emp_type else EmploymentType.FULL_TIME,
            start_date=start_date,
            extraction_confidence=confidence,
            notes="Extracted using text pattern matching"
        )

    @staticmethod
    def _fallback_text_extraction(text_content: str) -> ExtractedWorkData:
        """Fallback: Extract from document text using simple patterns"""
        import re

        logger.info("🔍 Attempting fallback text extraction...")

        company = None
        job_title = None
        start_date = None

        # Common company patterns
        company_patterns = [
            r'(?:From|Company|Organization)[\s:]+([A-Z][A-Za-z\s&.,()]+(?:Ltd|LLP|Private Limited|Inc|Corp))',
            r'([A-Z][A-Za-z\s&.,()]+(?:Ltd|LLP|Private Limited|Inc|Corp))',
            r'For\s+([A-Z][A-Za-z\s&.,()]+(?:LLP|Ltd))',
        ]

        for pattern in company_patterns:
            match = re.search(pattern, text_content, re.MULTILINE)
            if match:
                company = match.group(1).strip()
                logger.info(f"   Found company: {company}")
                break

        # Job title patterns
        title_patterns = [
            r'(?:position|designation|role|title)[\s:]+["\']?([A-Za-z\s-]+)["\']?',
            r'(?:appointed as|joining as)[\s:]+["\']?([A-Za-z\s-]+)["\']?',
            r'Executive[-\s]([A-Za-z\s&]+)',
        ]

        for pattern in title_patterns:
            match = re.search(pattern, text_content,
                              re.IGNORECASE | re.MULTILINE)
            if match:
                job_title = match.group(1).strip()
                logger.info(f"   Found title: {job_title}")
                break

        # Date patterns
        date_patterns = [
            r'(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})',
            r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})',
        ]

        for pattern in date_patterns:
            match = re.search(pattern, text_content)
            if match:
                # Convert to DD/MM/YYYY
                try:
                    if len(match.groups()) == 3:
                        day, month, year = match.groups()
                        if month.isalpha():
                            # Convert month name to number
                            from datetime import datetime
                            month_num = datetime.strptime(
                                month[:3], '%b').month
                            start_date = f"{int(day):02d}/{month_num:02d}/{year}"
                        else:
                            start_date = f"{int(day):02d}/{int(month):02d}/{year}"
                        logger.info(f"   Found date: {start_date}")
                        break
                except:
                    pass

        confidence = 0.0
        if company:
            confidence += 0.4
        if job_title:
            confidence += 0.4
        if start_date:
            confidence += 0.2

        return ExtractedWorkData(
            company_name=company,
            job_title=job_title,
            start_date=start_date,
            employment_type=EmploymentType.FULL_TIME,
            extraction_confidence=confidence,
            notes="Extracted using fallback text patterns"
        )

    @staticmethod
    def extract_parallel(documents: List[DocumentInfo]) -> List[ExtractedWorkData]:
        """Extract from multiple documents in parallel"""
        with ThreadPoolExecutor(max_workers=min(len(documents), Config.MAX_THREADS)) as executor:
            futures = [executor.submit(WorkExperienceExtractor.extract_from_document, doc)
                       for doc in documents]
            results = []
            for future in as_completed(futures):
                try:
                    result = future.result(timeout=Config.TIMEOUT_SECONDS)
                    results.append(result)
                except Exception as e:
                    logger.error(f"❌ Parallel extraction failed: {str(e)}")
                    results.append(ExtractedWorkData(
                        extraction_confidence=0.0,
                        notes=f"Failed: {str(e)[:100]}"
                    ))
            return results
# =========================
# Verification Node (Parallel)
# =========================
# Add this to work_experience.py - Replace the WorkExperienceVerifier class


class WorkExperienceVerifier:
    """Lightweight work experience verifier"""

    @staticmethod
    def verify_single(data: ExtractedWorkData) -> VerificationResult:
        """Verify single work experience entry - lightweight version"""
        try:
            # Lightweight verification - mostly programmatic checks
            issues = []
            warnings = []
            confidence = "high"

            # Required field checks
            if not data.company_name or len(data.company_name.strip()) < 2:
                issues.append("Company name missing or too short")
                confidence = "low"

            if not data.job_title or len(data.job_title.strip()) < 2:
                issues.append("Job title missing or too short")
                confidence = "low"

            # Date validation
            if data.start_date:
                try:
                    day, month, year = map(int, data.start_date.split('/'))
                    if year < Config.MIN_START_YEAR or year > Config.MAX_FUTURE_YEAR:
                        issues.append(f"Start year {year} out of valid range")
                        confidence = "medium" if confidence == "high" else "low"
                except:
                    issues.append("Invalid start date format")
                    confidence = "low"
            else:
                warnings.append("Start date not provided")
                confidence = "medium" if confidence == "high" else confidence

            # End date chronology check
            if data.end_date and data.start_date:
                try:
                    start_day, start_month, start_year = map(
                        int, data.start_date.split('/'))
                    end_day, end_month, end_year = map(
                        int, data.end_date.split('/'))

                    start_dt = datetime(start_year, start_month, start_day)
                    end_dt = datetime(end_year, end_month, end_day)

                    if end_dt < start_dt:
                        issues.append("End date before start date")
                        confidence = "low"
                except:
                    warnings.append("Could not validate date chronology")

            # Currently working validation
            if data.currently_working and data.end_date:
                try:
                    end_day, end_month, end_year = map(
                        int, data.end_date.split('/'))
                    end_dt = datetime(end_year, end_month, end_day)
                    if end_dt < datetime.now():
                        warnings.append(
                            "Marked as currently working but has past end date")
                except:
                    pass

            # Salary validation (if provided)
            if data.stipend_amount:
                if data.stipend_amount < Config.MIN_SALARY:
                    warnings.append(
                        f"Salary (₹{data.stipend_amount}) seems low")
                elif data.stipend_amount > Config.MAX_SALARY:
                    warnings.append(
                        f"Salary (₹{data.stipend_amount}) seems very high")

            # Extraction confidence factor
            if data.extraction_confidence < 0.7:
                if confidence == "high":
                    confidence = "medium"
                warnings.append("Document quality could be better")

            # Determine validity
            valid = len(issues) == 0

            # Build reason
            if valid:
                reason = "All required fields present and valid"
            else:
                reason = f"Found {len(issues)} validation issue(s)"

            logger.info(
                f"✅ Verified: {data.company_name} - {valid} ({confidence})")

            return VerificationResult(
                valid=valid,
                confidence=confidence,
                reason=reason,
                issues=issues,
                warnings=warnings
            )

        except Exception as e:
            logger.error(f"❌ Verification failed: {str(e)}")
            return VerificationResult(
                valid=False,
                confidence="low",
                reason=f"Verification error: {str(e)[:100]}",
                issues=["Verification process failed"]
            )

    @staticmethod
    def verify_parallel(data_list: List[ExtractedWorkData]) -> List[VerificationResult]:
        """Verify multiple entries - using lightweight verification"""
        if not data_list:
            return []

        # Since verification is now lightweight, we can process sequentially
        # or use threads if needed
        results = []
        for data in data_list:
            try:
                result = WorkExperienceVerifier.verify_single(data)
                results.append(result)
            except Exception as e:
                logger.error(f"❌ Verification failed: {str(e)}")
                results.append(VerificationResult(
                    valid=False,
                    confidence="low",
                    reason=f"Verification failed: {str(e)[:100]}"
                ))

        return results
# =========================
# LangGraph Workflow
# =========================


class WorkExperienceWorkflow:
    """LangGraph workflow for work experience processing"""

    @staticmethod
    def build_workflow() -> StateGraph:
        """Build LangGraph workflow"""
        workflow = StateGraph(Dict[str, Any])

        workflow.add_node("load_documents",
                          WorkExperienceWorkflow._load_documents_node)
        workflow.add_node("extract_parallel",
                          WorkExperienceWorkflow._extract_parallel_node)
        workflow.add_node("verify_parallel",
                          WorkExperienceWorkflow._verify_parallel_node)
        workflow.add_node("combine_results",
                          WorkExperienceWorkflow._combine_results_node)

        workflow.set_entry_point("load_documents")
        workflow.add_edge("load_documents", "extract_parallel")
        workflow.add_edge("extract_parallel", "verify_parallel")
        workflow.add_edge("verify_parallel", "combine_results")
        workflow.add_edge("combine_results", END)

        return workflow.compile()

    @staticmethod
    def _load_documents_node(state: Dict[str, Any]) -> Dict[str, Any]:
        """Load documents node"""
        logger.info("📂 Loading documents...")
        file_paths = state.get("file_paths", [])
        processing_state = state.get(
            "processing_state") or ProcessingState(status="processing")

        try:
            with ThreadPoolExecutor(max_workers=min(len(file_paths), Config.MAX_THREADS)) as executor:
                futures = [executor.submit(DocumentLoader.load_document, path)
                           for path in file_paths]

                for future in as_completed(futures):
                    try:
                        doc_info = future.result(timeout=30)
                        processing_state.document_infos.append(doc_info)
                    except Exception as e:
                        processing_state.errors.append(
                            f"Failed to load document: {str(e)}")
                        logger.error(f"❌ Failed to load document: {str(e)}")

            logger.info(
                f"✅ Loaded {len(processing_state.document_infos)} documents")

        except Exception as e:
            processing_state.errors.append(
                f"Document loading failed: {str(e)}")
            processing_state.status = "failed"
            logger.error(f"❌ Document loading failed: {str(e)}")

        state["processing_state"] = processing_state
        return state

    @staticmethod
    def _extract_parallel_node(state: Dict[str, Any]) -> Dict[str, Any]:
        """Parallel extraction node"""
        processing_state = state["processing_state"]

        if processing_state.status == "failed":
            return state

        logger.info("🔍 Starting parallel extraction...")

        try:
            extracted_data = WorkExperienceExtractor.extract_parallel(
                processing_state.document_infos
            )
            processing_state.extracted_data = extracted_data

            valid_extractions = [
                d for d in extracted_data if d.extraction_confidence >= 0.5]
            success_rate = len(valid_extractions) / \
                len(extracted_data) if extracted_data else 0

            logger.info(f"✅ Extracted {len(valid_extractions)}/{len(extracted_data)} "
                        f"documents (success rate: {success_rate:.1%})")

        except Exception as e:
            processing_state.errors.append(f"Extraction failed: {str(e)}")
            processing_state.status = "failed"
            logger.error(f"❌ Extraction failed: {str(e)}")

        state["processing_state"] = processing_state
        return state

    @staticmethod
    def _verify_parallel_node(state: Dict[str, Any]) -> Dict[str, Any]:
        """Parallel verification node"""
        processing_state = state["processing_state"]

        if processing_state.status == "failed":
            return state

        logger.info("🔐 Starting parallel verification...")

        try:
            verification_results = WorkExperienceVerifier.verify_parallel(
                processing_state.extracted_data
            )
            processing_state.verification_results = verification_results

            valid_count = sum(1 for v in verification_results if v.valid)
            high_confidence = sum(
                1 for v in verification_results if v.confidence == "high")

            logger.info(f"✅ Verified {valid_count}/{len(verification_results)} entries "
                        f"(high confidence: {high_confidence})")

        except Exception as e:
            processing_state.errors.append(f"Verification failed: {str(e)}")
            processing_state.status = "failed"
            logger.error(f"❌ Verification failed: {str(e)}")

        state["processing_state"] = processing_state
        return state

    @staticmethod
    def _combine_results_node(state: Dict[str, Any]) -> Dict[str, Any]:
        """Combine results node"""
        processing_state = state["processing_state"]

        if processing_state.status == "failed":
            processing_state.combined_result = {
                "status": "failed",
                "error": "; ".join(processing_state.errors[-3:]),
                "errors": processing_state.errors,
                "documents_processed": len(processing_state.document_infos),
                "extractions_successful": 0,
                "verifications_valid": 0,
                "processing_time": processing_state.processing_time
            }
            return state

        logger.info("📦 Combining results...")

        try:
            work_experiences = []

            # ✅ Ensure all lists have the same length
            for i in range(len(processing_state.document_infos)):
                doc_info = processing_state.document_infos[i]
                extracted = processing_state.extracted_data[i] if i < len(
                    processing_state.extracted_data) else ExtractedWorkData()
                verified = processing_state.verification_results[i] if i < len(
                    processing_state.verification_results) else VerificationResult()

                work_exp = {
                    "document": {
                        "filename": doc_info.filename,
                        "page_count": doc_info.page_count,
                        "quality_score": doc_info.quality_score,
                        "size_mb": doc_info.size_mb
                    },
                    "extracted_data": asdict(extracted),
                    "verification": asdict(verified),
                    "overall_confidence": extracted.extraction_confidence * (
                        1.0 if verified.confidence == "high" else
                        0.7 if verified.confidence == "medium" else
                        0.4
                    )
                }
                work_experiences.append(work_exp)

            valid_extractions = [d for d in processing_state.extracted_data
                                 if d.extraction_confidence >= 0.5]
            valid_verifications = [v for v in processing_state.verification_results
                                   if v.valid]

            overall_confidence = np.mean([
                exp["overall_confidence"] for exp in work_experiences
            ]) if work_experiences else 0.0

            processing_state.combined_result = {
                "status": "completed",
                "work_experiences": work_experiences,
                "statistics": {
                    "documents_processed": len(processing_state.document_infos),
                    "extractions_successful": len(valid_extractions),
                    "verifications_valid": len(valid_verifications),
                    "overall_confidence": overall_confidence,
                    "success_rate": len(valid_extractions) / len(processing_state.document_infos)
                    if processing_state.document_infos else 0,
                    "average_quality": np.mean([d.quality_score for d in processing_state.document_infos])
                    if processing_state.document_infos else 0
                },
                "errors": processing_state.errors,
                "warnings": [w for v in processing_state.verification_results
                             for w in v.warnings][:10],
                "processing_time": processing_state.processing_time
            }

            processing_state.status = "completed"
            logger.info(f"✅ Combined {len(work_experiences)} work experiences "
                        f"(confidence: {overall_confidence:.2f})")

        except Exception as e:
            processing_state.errors.append(
                f"Result combination failed: {str(e)}")
            processing_state.status = "failed"
            processing_state.combined_result = {
                "status": "failed",
                "error": str(e),
                "errors": processing_state.errors
            }
            logger.error(f"❌ Result combination failed: {str(e)}")

        state["processing_state"] = processing_state
        return state

# =========================
# Main Processor
# =========================


class WorkExperienceProcessor:
    """Main processor with LangGraph workflow"""

    def __init__(self):
        Config.validate()
        self.workflow = WorkExperienceWorkflow.build_workflow()
        logger.info("✅ Work Experience Processor initialized")

    def process_documents(self, file_paths: List[str]) -> Dict[str, Any]:
        """Process documents and return results"""
        start_time = time.time()

        try:
            logger.info(
                f"🚀 Processing {len(file_paths)} work experience documents...")

            initial_state = {
                "file_paths": file_paths,
                "processing_state": ProcessingState(
                    status="pending",
                    processing_time=0.0
                )
            }

            result_state = self.workflow.invoke(initial_state)
            processing_state = result_state["processing_state"]

            processing_time = time.time() - start_time
            processing_state.processing_time = processing_time

            if processing_state.combined_result:
                processing_state.combined_result["processing_time"] = processing_time

            logger.info(f"✅ Processing completed in {processing_time:.2f}s")

            return {
                "success": processing_state.status == "completed",
                "result": processing_state.combined_result,
                "processing_state": asdict(processing_state),
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"❌ Processing failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "processing_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

    def process_single_document(self, file_path: str) -> Dict[str, Any]:
        """Process single document (simplified)"""
        return self.process_documents([file_path])

# =========================
# Singleton Instance
# =========================


_processor_instance = None


def get_work_experience_processor():
    """Get singleton processor instance"""
    global _processor_instance
    if _processor_instance is None:
        _processor_instance = WorkExperienceProcessor()
    return _processor_instance
