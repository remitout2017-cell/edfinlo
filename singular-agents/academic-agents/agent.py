"""
Academic Records Multi-Agent Pipeline with Immediate Fallback
- Extraction: Gemini → OpenRouter (immediate switch on quota)
- Gap Detection: Built-in education timeline analysis
- Production-ready with error handling
"""

import os
import json
import base64
import threading
import re
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
import statistics
from dotenv import load_dotenv

# Import all model providers
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage

# ============================================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================================
load_dotenv()

if not os.getenv("GEMINI_API_KEY") and not os.getenv("OPENROUTER_API_KEY"):
    raise ValueError(
        "❌ Either GEMINI_API_KEY or OPENROUTER_API_KEY must be set!")

print("✅ Environment variables loaded successfully")

# ============================================================================
# CONFIGURATION
# ============================================================================


class Config:
    # API Keys
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    # General settings
    MAX_RETRIES = int(os.getenv("MAX_RETRIES", "1"))
    MAX_WORKERS = int(os.getenv("MAX_WORKERS", "4"))
    TIMEOUT_SECONDS = int(os.getenv("TIMEOUT_SECONDS", "30"))
    CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.70"))

    # Extraction models
    EXTRACTION_MODEL = os.getenv("EXTRACTION_MODEL", "gemini-1.5-flash")
    EXTRACTION_FALLBACK_MODEL = os.getenv(
        "EXTRACTION_FALLBACK_MODEL", "google/gemini-flash-1.5")

    @classmethod
    def validate(cls):
        """Validate configuration"""
        if not cls.GEMINI_API_KEY and not cls.OPENROUTER_API_KEY:
            raise ValueError(
                "At least one API key (Gemini or OpenRouter) is required")


Config.validate()

# ============================================================================
# HELPERS
# ============================================================================


def encode_image(image_path: str) -> str:
    """Encode image to base64"""
    if not image_path or not str(image_path).strip():
        raise ValueError("Image path is empty")

    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def extract_text_from_response(resp) -> str:
    """Extract text from any model response"""
    try:
        if hasattr(resp, 'text') and resp.text:
            return str(resp.text)
        if hasattr(resp, 'content'):
            content = resp.content
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                text_parts = []
                for item in content:
                    if isinstance(item, dict) and 'text' in item:
                        text_parts.append(str(item['text']))
                    elif isinstance(item, str):
                        text_parts.append(item)
                if text_parts:
                    return '\n'.join(text_parts)
        return str(resp)
    except Exception as e:
        print(f"⚠️ Error extracting text: {e}")
        return str(resp)


def parse_json_from_text(text: str) -> Dict[str, Any]:
    """Robust JSON extraction"""
    try:
        if not text:
            return {"error": "Empty response", "extraction_confidence": 0.0}

        if not isinstance(text, str):
            text = str(text)

        text = text.strip()

        # Direct JSON parse
        if text.startswith("{") and text.endswith("}"):
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                pass

        # Remove markdown
        if "```" in text:
            cleaned = re.sub(r'```(?:json|JSON)?', '', text)
            cleaned = cleaned.strip()
            if cleaned.startswith("{") and cleaned.endswith("}"):
                try:
                    return json.loads(cleaned)
                except json.JSONDecodeError:
                    pass
        
        # Extract JSON
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        
        # Fix common issues
        try:
            fixed_text = re.sub(r',(\s*[}\]])', r'\1', text)
            return json.loads(fixed_text)
        except json.JSONDecodeError:
            pass
        
        return {
            "error": "No valid JSON found",
            "extraction_confidence": 0.0,
            "raw_preview": text[:500]
        }
    
    except Exception as e:
        return {
            "error": f"Parse error: {str(e)}",
            "extraction_confidence": 0.0
        }

# ============================================================================
# MODEL MANAGER (with immediate fallback)
# ============================================================================
class ModelManager:
    _lock = threading.Lock()
    _gemini_models = []
    _openrouter_models = []
    _pool_size = Config.MAX_WORKERS
    
    # Track quota errors
    _gemini_quota_error_detected = False
    _use_openrouter = False
    
    @classmethod
    def get_extraction_model(cls):
        """Get extraction model (switches to OpenRouter permanently on quota)"""
        with cls._lock:
            if cls._use_openrouter or cls._gemini_quota_error_detected:
                return cls._get_openrouter_model(), "OpenRouter"
            
            if Config.GEMINI_API_KEY:
                try:
                    return cls._get_gemini_model(), "Gemini"
                except Exception as e:
                    print(f"⚠️ Gemini initialization failed: {e}")
                    cls._use_openrouter = True
                    return cls._get_openrouter_model(), "OpenRouter"
            else:
                return cls._get_openrouter_model(), "OpenRouter"
    
    @classmethod
    def mark_gemini_quota_error(cls):
        """Mark Gemini quota error detected"""
        with cls._lock:
            if not cls._gemini_quota_error_detected:
                print("🔄 Gemini quota error detected, switching to OpenRouter")
                cls._gemini_quota_error_detected = True
                cls._use_openrouter = True
    
    @classmethod
    def _get_gemini_model(cls):
        """Get Gemini model with NO internal retries"""
        if not Config.GEMINI_API_KEY:
            raise ValueError("Gemini API key not available")
        
        if not cls._gemini_models:
            for _ in range(cls._pool_size):
                model = ChatGoogleGenerativeAI(
                    google_api_key=Config.GEMINI_API_KEY,
                    model=Config.EXTRACTION_MODEL,
                    temperature=0.1,
                    max_output_tokens=2000,
                    max_retries=0,
                    timeout=20,
                )
                cls._gemini_models.append(model)
        
        return cls._gemini_models[threading.get_ident() % len(cls._gemini_models)]
    
    @classmethod
    def _get_openrouter_model(cls):
        """Get OpenRouter extraction model"""
        if not Config.OPENROUTER_API_KEY:
            raise ValueError("OpenRouter API key not available")
        
        if not cls._openrouter_models:
            for _ in range(cls._pool_size):
                model = ChatOpenAI(
                    model=Config.EXTRACTION_FALLBACK_MODEL,
                    openai_api_key=Config.OPENROUTER_API_KEY,
                    openai_api_base="https://openrouter.ai/api/v1",
                    temperature=0.1,
                    max_tokens=2000,
                    max_retries=0,
                    timeout=20,
                )
                cls._openrouter_models.append(model)
        
        return cls._openrouter_models[threading.get_ident() % len(cls._openrouter_models)]

# ============================================================================
# GAP DETECTION
# ============================================================================
@dataclass
class EducationMilestone:
    """Represents an education milestone in the timeline"""
    level: str
    year_of_passing: Optional[int]
    start_year: Optional[int] = None
    duration_years: Optional[int] = None
    is_formal: bool = True
    
    @property
    def completion_year(self) -> Optional[int]:
        return self.year_of_passing
    
    @property
    def expected_start_year(self) -> Optional[int]:
        if self.year_of_passing and self.duration_years:
            return self.year_of_passing - self.duration_years
        return self.start_year

class GapDetector:
    """Detects gaps in education timeline"""
    
    STANDARD_DURATIONS = {
        "10th": 0,
        "12th": 2,
        "bachelor": 3,
        "bachelors": 3,
        "master": 2,
        "masters": 2,
        "diploma": 2,
        "certificate": 0,
    }
    
    @staticmethod
    def infer_duration_from_education_type(edu_type: str) -> int:
        return GapDetector.STANDARD_DURATIONS.get(edu_type.lower(), 3)
    
    @staticmethod
    def extract_milestones_from_payload(payload: Dict[str, Any]) -> List[EducationMilestone]:
        """Extract education milestones from the extraction payload"""
        milestones = []
        
        # Add Class 10
        if payload.get("class10") and payload["class10"].get("marksheets"):
            marksheet = payload["class10"]["marksheets"][0]
            year = marksheet.get("yearOfPassing")
            if year:
                milestones.append(EducationMilestone(
                    level="10th",
                    year_of_passing=year,
                    is_formal=True
                ))
        
        # Add Class 12
        if payload.get("class12") and payload["class12"].get("marksheets"):
            marksheet = payload["class12"]["marksheets"][0]
            year = marksheet.get("yearOfPassing")
            if year:
                milestones.append(EducationMilestone(
                    level="12th",
                    year_of_passing=year,
                    is_formal=True
                ))
        
        # Add higher education
        for edu in payload.get("higherEducation", []):
            edu_type = edu.get("educationType", "").lower()
            is_formal = edu_type not in ["certificate", "professional"]
            
            if edu.get("marksheets"):
                marksheet = edu["marksheets"][0]
                year = marksheet.get("yearOfPassing")
                if year:
                    duration = None
                    duration_str = edu.get("duration")
                    if duration_str:
                        match = re.search(r'(\d+)\s*(?:year|yr|y)', str(duration_str), re.IGNORECASE)
                        if match:
                            duration = int(match.group(1))
                    
                    if duration is None:
                        duration = GapDetector.infer_duration_from_education_type(edu_type)
                    
                    milestones.append(EducationMilestone(
                        level=edu_type,
                        year_of_passing=year,
                        duration_years=duration,
                        is_formal=is_formal
                    ))
        
        milestones.sort(key=lambda x: x.year_of_passing or 9999)
        return milestones
    
    @staticmethod
    def detect_gaps(milestones: List[EducationMilestone]) -> List[Dict[str, Any]]:
        """Detect gaps between formal education milestones"""
        gaps = []
        
        formal_milestones = [m for m in milestones if m.is_formal and m.year_of_passing is not None]
        
        if len(formal_milestones) < 2:
            return gaps
        
        level_sequence = ["10th", "12th", "bachelor", "master"]
        
        sequenced = []
        for milestone in formal_milestones:
            level = milestone.level.lower()
            if level in level_sequence:
                position = level_sequence.index(level)
                sequenced.append((position, milestone))
        
        sequenced.sort(key=lambda x: x[0])
        
        for i in range(len(sequenced) - 1):
            curr_pos, curr_milestone = sequenced[i]
            next_pos, next_milestone = sequenced[i + 1]
            
            if curr_milestone.level == "10th" and next_milestone.level == "12th":
                expected_next_year = curr_milestone.year_of_passing + 2
                gap_type = "after_10th"
            elif curr_milestone.level == "12th" and next_milestone.level in ["bachelor", "bachelors"]:
                expected_next_year = curr_milestone.year_of_passing + 1
                if next_milestone.duration_years:
                    expected_next_year += next_milestone.duration_years
                gap_type = "after_12th"
            else:
                expected_next_year = curr_milestone.year_of_passing
                if curr_milestone.duration_years:
                    expected_next_year += curr_milestone.duration_years
                gap_type = "between_education"
            
            actual_next_year = next_milestone.year_of_passing
            
            if next_milestone.expected_start_year:
                gap_years = next_milestone.expected_start_year - expected_next_year
            else:
                gap_years = actual_next_year - expected_next_year
            
            if gap_years >= 1:
                gaps.append({
                    "gap_type": gap_type,
                    "gap_years": gap_years,
                    "from_education": curr_milestone.level,
                    "from_year": curr_milestone.year_of_passing,
                    "to_education": next_milestone.level,
                    "to_year": next_milestone.year_of_passing,
                    "is_significant": gap_years >= 2,
                    "explanation": f"Gap of {gap_years} year(s) between {curr_milestone.level} and {next_milestone.level}"
                })
        
        return gaps
    
    @staticmethod
    def analyze_timeline_consistency(milestones: List[EducationMilestone]) -> Dict[str, Any]:
        """Analyze overall timeline consistency"""
        formal_years = [m.year_of_passing for m in milestones if m.is_formal and m.year_of_passing]
        
        if len(formal_years) < 2:
            return {
                "timeline_consistent": True,
                "total_formal_years": len(formal_years),
                "assessment": "Insufficient data"
            }
        
        is_chronological = all(formal_years[i] <= formal_years[i + 1] for i in range(len(formal_years) - 1))
        
        gaps = [formal_years[i + 1] - formal_years[i] for i in range(len(formal_years) - 1)]
        avg_gap = statistics.mean(gaps) if gaps else 0
        
        return {
            "timeline_consistent": is_chronological,
            "total_formal_years": len(formal_years),
            "earliest_year": min(formal_years) if formal_years else None,
            "latest_year": max(formal_years) if formal_years else None,
            "average_gap_years": round(avg_gap, 1),
            "assessment": "Timeline appears normal" if is_chronological and avg_gap <= 5 else "Review timeline for gaps"
        }

# ============================================================================
# DOCUMENT EXTRACTOR
# ============================================================================
class DocumentExtractor:
    @staticmethod
    def extract_with_retry(doc_type: str, image_path: str, prompt: str) -> Dict[str, Any]:
        """Extract document with automatic fallback"""
        print(f"🔍 [{doc_type}] Starting extraction...")
        
        if not image_path or not str(image_path).strip():
            return {"status": "failed", "error": "Empty image path", "data": {}}
        
        last_error = None
        
        # Try primary model first (Gemini)
        for attempt in range(1):
            try:
                base64_image = encode_image(image_path)
                model, model_name = ModelManager.get_extraction_model()
                
                # If quota already detected, skip to OpenRouter
                if model_name == "Gemini" and ModelManager._gemini_quota_error_detected:
                    print(f"🔄 [{doc_type}] Gemini quota previously exceeded, using OpenRouter")
                    model, model_name = ModelManager._get_openrouter_model(), "OpenRouter"
                
                messages = [
                    HumanMessage(content=[
                        {"type": "text", "text": f"{prompt}\n\nReturn ONLY valid JSON."},
                        {"type": "image_url", "image_url": f"data:image/jpeg;base64,{base64_image}"},
                    ]),
                ]
                
                resp = model.invoke(messages)
                raw = extract_text_from_response(resp)
                print(f"📝 [{doc_type}] Using {model_name}, response preview: {raw[:200]}")
                
                extracted = parse_json_from_text(raw)
                
                if extracted.get("error"):
                    last_error = extracted.get("error")
                    break
                
                print(f"✅ [{doc_type}] {model_name} extraction successful")
                return {"status": "success", "data": extracted, "model_used": model_name}
            
            except Exception as e:
                last_error = str(e)
                error_str = str(e).lower()
                
                # Check for quota errors and switch IMMEDIATELY
                if any(x in error_str for x in ["quota", "429", "rate limit", "resourceexhausted"]):
                    print(f"⚠️ [{doc_type}] Quota exceeded! Switching to OpenRouter...")
                    ModelManager.mark_gemini_quota_error()
                    break
                
                print(f"❌ [{doc_type}] Error with primary model: {last_error[:200]}")
                break
        
        # Try OpenRouter fallback
        try:
            print(f"🔄 [{doc_type}] Trying OpenRouter fallback...")
            base64_image = encode_image(image_path)
            model = ModelManager._get_openrouter_model()
            
            messages = [
                HumanMessage(content=[
                    {"type": "text", "text": f"{prompt}\n\nReturn ONLY valid JSON."},
                    {"type": "image_url", "image_url": f"data:image/jpeg;base64,{base64_image}"},
                ]),
            ]
            
            resp = model.invoke(messages)
            raw = extract_text_from_response(resp)
            extracted = parse_json_from_text(raw)
            
            print(f"✅ [{doc_type}] OpenRouter extraction successful")
            return {"status": "success", "data": extracted, "model_used": "OpenRouter"}
        
        except Exception as e:
            last_error = str(e)
            print(f"❌ [{doc_type}] OpenRouter fallback also failed: {last_error[:200]}")
        
        return {"status": "failed", "error": last_error or "All attempts failed", "data": {}}

# ============================================================================
# SPECIFIC EXTRACTORS
# ============================================================================
class Class10Extractor(DocumentExtractor):
    PROMPT = """Extract Class 10th marksheet information. Return JSON:
{
  "marksheets": [{
    "yearOfPassing": 2018,
    "boardName": "CBSE",
    "totalMarks": 450,
    "obtainedMarks": 380,
    "percentage": 84.44
  }]
}"""
    
    @classmethod
    def extract(cls, image_path: str) -> Dict[str, Any]:
        return cls.extract_with_retry("class10", image_path, cls.PROMPT)

class Class12Extractor(DocumentExtractor):
    PROMPT = """Extract Class 12th marksheet information. Return JSON:
{
  "marksheets": [{
    "yearOfPassing": 2020,
    "boardName": "State Board",
    "stream": "Science",
    "totalMarks": 500,
    "obtainedMarks": 420,
    "percentage": 84.0
  }]
}"""
    
    @classmethod
    def extract(cls, image_path: str) -> Dict[str, Any]:
        return cls.extract_with_retry("class12", image_path, cls.PROMPT)

class GraduationExtractor(DocumentExtractor):
    PROMPT = """Extract graduation/higher education information. Return JSON:
{
  "marksheets": [{
    "yearOfPassing": 2023,
    "instituteName": "University Name",
    "educationType": "bachelor",
    "fieldOfStudy": "Computer Science",
    "duration": "3 years",
    "cgpa": 8.5,
    "percentage": 85.0
  }]
}"""
    
    @classmethod
    def extract(cls, image_path: str) -> Dict[str, Any]:
        return cls.extract_with_retry("graduation", image_path, cls.PROMPT)

# ============================================================================
# MAIN PROCESSING FUNCTION
# ============================================================================
def build_payload(
    in_paths: Dict[str, Any],
    cls10: Dict[str, Any],
    cls12: Dict[str, Any],
    grad: Dict[str, Any]
) -> Dict[str, Any]:
    """Build final payload"""
    
    payload = {
        "class10": cls10.get("data", {}),
        "class12": cls12.get("data", {}),
        "higherEducation": [grad.get("data", {})] if grad.get("data") else [],
        "overallVerificationStatus": "complete"
    }
    
    # Add gap detection
    milestones = GapDetector.extract_milestones_from_payload(payload)
    gaps = GapDetector.detect_gaps(milestones)
    timeline_analysis = GapDetector.analyze_timeline_consistency(milestones)
    
    payload["educationGapAnalysis"] = {
        "detected_gaps": gaps,
        "total_gaps": len(gaps),
        "has_significant_gaps": any(gap.get("is_significant", False) for gap in gaps),
        "gap_after_10th": any(gap["gap_type"] == "after_10th" for gap in gaps),
        "gap_after_12th": any(gap["gap_type"] == "after_12th" for gap in gaps),
        "timeline_analysis": timeline_analysis,
        "education_milestones": [
            {
                "level": m.level,
                "completion_year": m.year_of_passing,
                "duration_years": m.duration_years,
                "is_formal": m.is_formal
            }
            for m in milestones
        ],
        "analysis_timestamp": datetime.now().isoformat()
    }
    
    if gaps:
        if payload["overallVerificationStatus"] == "complete":
            payload["overallVerificationStatus"] = "complete_with_gaps"
    
    return payload

def process_academic_records_enhanced(
    inputs: Dict[str, Any],
    use_groq_verifier: bool = False,
    enable_gap_detection: bool = True
) -> Dict[str, Any]:
    """Process academic records with gap detection"""
    start_time = datetime.now()
    
    try:
        class10_path = (inputs.get("class10") or "").strip()
        class12_path = (inputs.get("class12") or "").strip()
        grad_pdf_path = (inputs.get("graduation_pdf") or "").strip()
        
        # Extract documents in parallel
        results = {}
        with ThreadPoolExecutor(max_workers=Config.MAX_WORKERS) as ex:
            tasks = {}
            if class10_path:
                tasks[ex.submit(Class10Extractor.extract, class10_path)] = "class10"
            if class12_path:
                tasks[ex.submit(Class12Extractor.extract, class12_path)] = "class12"
            if grad_pdf_path:
                tasks[ex.submit(GraduationExtractor.extract, grad_pdf_path)] = "graduation"
            
            for fut in as_completed(tasks):
                doc_type = tasks[fut]
                try:
                    results[doc_type] = fut.result(timeout=Config.TIMEOUT_SECONDS)
                except Exception as e:
                    results[doc_type] = {"status": "failed", "error": str(e), "data": {}}
        
        cls10 = results.get("class10", {"status": "skipped", "data": {}})
        cls12 = results.get("class12", {"status": "skipped", "data": {}})
        grad = results.get("graduation", {"status": "skipped", "data": {}})
        
        # Build payload
        payload = build_payload(
            {"class10": class10_path, "class12": class12_path, "graduation_pdf": grad_pdf_path},
            cls10, cls12, grad
        )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "status": "ok",
            "payload": payload,
            "processing_time": processing_time,
            "extraction_status": {
                "class10": cls10.get("status"),
                "class12": cls12.get("status"),
                "graduation": grad.get("status")
            },
            "summary": {
                "total_documents": len([p for p in [class10_path, class12_path, grad_pdf_path] if p]),
                "gap_analysis": {
                    "total_gaps_detected": payload.get("educationGapAnalysis", {}).get("total_gaps", 0),
                    "has_education_gaps": payload.get("educationGapAnalysis", {}).get("has_significant_gaps", False)
                }
            }
        }
    
    except Exception as e:
        print(f"❌ Processing error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "message": str(e),
            "processing_time": (datetime.now() - start_time).total_seconds()
        }

# For backward compatibility
def process_academic_records(inputs: Dict[str, Any], use_groq_verifier: bool = False) -> Dict[str, Any]:
    """Legacy function - calls enhanced version"""
    return process_academic_records_enhanced(inputs, use_groq_verifier, enable_gap_detection=False)

if __name__ == "__main__":
    # Test
    example_inputs = {
        "class10": "path/to/10th.png",
        "class12": "path/to/12th.png",
        "graduation_pdf": "path/to/grad.pdf"
    }
    
    result = process_academic_records_enhanced(example_inputs, enable_gap_detection=True)
    print(json.dumps(result, indent=2))
