"""
agents/admission_letter_workflow.py - Multi-agent Admission Letter Processing with Multi-Threading
"""

import asyncio
import json
import time
import threading
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
import hashlib
import functools

import google.generativeai as genai
from groq import Groq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
import redis.asyncio as redis

from config import settings
from utils.rate_limiter import RateLimiter
from utils.cache_decorator import async_cache, cache_result
from utils.performance_tracker import track_performance

# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class ExtractionResult:
    """Extracted admission letter data"""
    university_name: Optional[str] = None
    program_name: Optional[str] = None
    intake_term: Optional[str] = None
    intake_year: Optional[int] = None
    country: Optional[str] = None
    city: Optional[str] = None
    degree_level: Optional[str] = None
    duration: Optional[str] = None
    tuition_fee: Optional[str] = None
    scholarship_mentioned: bool = False
    documents_required: List[str] = None
    deadlines: Dict[str, Optional[str]] = None
    extraction_metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.documents_required is None:
            self.documents_required = []
        if self.deadlines is None:
            self.deadlines = {
                "acceptance_deadline": None,
                "enrollment_deadline": None,
                "fee_payment_deadline": None
            }
        if self.extraction_metadata is None:
            self.extraction_metadata = {
                "document_quality": "unknown",
                "fields_extracted": 0,
                "confidence": 0,
                "readability_issues": []
            }

@dataclass
class ValidationResult:
    """Validation result"""
    valid: bool = False
    overall_confidence: str = "low"
    field_validation: Dict[str, Any] = None
    document_authenticity: Dict[str, Any] = None
    critical_issues: List[str] = None
    warnings: List[str] = None
    recommendations: List[str] = None
    
    def __post_init__(self):
        if self.field_validation is None:
            self.field_validation = {}
        if self.document_authenticity is None:
            self.document_authenticity = {
                "appear_authentic": False,
                "red_flags": [],
                "missing_critical_info": []
            }
        if self.critical_issues is None:
            self.critical_issues = []
        if self.warnings is None:
            self.warnings = []
        if self.recommendations is None:
            self.recommendations = []

@dataclass
class RiskAssessment:
    """Risk assessment result"""
    verified: bool = False
    verification_level: str = "low"
    university_score: int = 0
    risk_level: str = "high"
    confidence: int = 0
    reason: str = ""
    university_reputation: Dict[str, Any] = None
    loan_approval_factors: Dict[str, Any] = None
    issues_found: List[str] = None
    strengths: List[str] = None
    nbfc_recommendations: List[str] = None
    
    def __post_init__(self):
        if self.university_reputation is None:
            self.university_reputation = {
                "is_recognized": False,
                "accreditation_status": "unknown",
                "reputation_notes": ""
            }
        if self.loan_approval_factors is None:
            self.loan_approval_factors = {
                "program_viability": "weak",
                "country_reputation": "concerning",
                "tuition_reasonable": "unknown",
                "employability_prospects": "low"
            }
        if self.issues_found is None:
            self.issues_found = []
        if self.strengths is None:
            self.strengths = []
        if self.nbfc_recommendations is None:
            self.nbfc_recommendations = []

@dataclass
class ImprovementRecommendations:
    """Improvement recommendations"""
    improvement_score: int = 0
    current_strength: str = "weak"
    immediate_actions: List[Dict[str, Any]] = None
    document_quality_improvements: List[str] = None
    additional_documents_suggested: List[str] = None
    nbfc_specific_tips: List[str] = None
    alternative_options: List[str] = None
    estimated_loan_approval_chance: str = "low"
    estimated_time_to_ready: str = "1 day"
    
    def __post_init__(self):
        if self.immediate_actions is None:
            self.immediate_actions = []
        if self.document_quality_improvements is None:
            self.document_quality_improvements = []
        if self.additional_documents_suggested is None:
            self.additional_documents_suggested = []
        if self.nbfc_specific_tips is None:
            self.nbfc_specific_tips = []
        if self.alternative_options is None:
            self.alternative_options = []

@dataclass
class ProcessResult:
    """Complete processing result"""
    extraction_result: ExtractionResult
    validation_result: ValidationResult
    risk_assessment: RiskAssessment
    improvement_recommendations: Optional[ImprovementRecommendations] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {
                "processing_time_ms": 0,
                "file_type": "",
                "agents_used": 3,
                "timestamp": datetime.utcnow().isoformat(),
                "cache_hit": False
            }

# ============================================================================
# AGENT POOL (Thread-safe Singleton)
# ============================================================================

class AgentPool:
    """Thread-safe agent pool with connection pooling"""
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self._lock = threading.Lock()
            self.gemini_client = None
            self.groq_client = None
            self._initialized = True
    
    def initialize(self):
        """Initialize AI clients"""
        with self._lock:
            if self.gemini_client is None:
                # Configure Gemini
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.gemini_client = ChatGoogleGenerativeAI(
                    model="gemini-1.5-flash",
                    google_api_key=settings.GEMINI_API_KEY,
                    temperature=0.1,
                    max_output_tokens=4096,
                    timeout=60
                )
            
            if self.groq_client is None:
                # Configure Groq
                self.groq_client = ChatGroq(
                    temperature=0.2,
                    groq_api_key=settings.GROQ_API_KEY,
                    model_name="llama-3.3-70b-versatile",
                    max_tokens=2048,
                    timeout=30
                )
    
    def get_gemini(self):
        """Get Gemini client"""
        if self.gemini_client is None:
            self.initialize()
        return self.gemini_client
    
    def get_groq(self):
        """Get Groq client"""
        if self.groq_client is None:
            self.initialize()
        return self.groq_client

# ============================================================================
# BASE AGENT CLASS
# ============================================================================

class BaseAgent:
    """Base agent with common functionality"""
    
    def __init__(self):
        self.agent_pool = AgentPool()
        self.rate_limiter = RateLimiter(
            max_calls_per_minute=settings.MAX_REQUESTS_PER_MINUTE,
            min_delay_ms=settings.MIN_REQUEST_DELAY_MS
        )
    
    @staticmethod
    def extract_text(response) -> str:
        """Extract text from various response formats"""
        if isinstance(response, str):
            return response
        
        # Try to extract from LangChain response
        if hasattr(response, 'content'):
            content = response.content
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                return " ".join(str(item) for item in content)
        
        # Try to extract from dict
        if isinstance(response, dict):
            if 'content' in response:
                return str(response['content'])
            if 'text' in response:
                return str(response['text'])
        
        return str(response)
    
    @staticmethod
    def safe_json_parse(text: str, fallback=None, context: str = "Agent") -> Any:
        """Safely parse JSON from text"""
        if not text:
            return fallback
        
        try:
            # Clean up JSON string
            text = text.strip()
            if text.startswith('```'):
                text = text.split('\n', 1)[1] if '\n' in text else ''
            if text.endswith('```'):
                text = text.rsplit('\n', 1)[0] if '\n' in text else ''
            
            # Find JSON object/array
            start_idx = text.find('{')
            end_idx = text.rfind('}') + 1
            if start_idx == -1:
                start_idx = text.find('[')
                end_idx = text.rfind(']') + 1
            
            if start_idx != -1 and end_idx > start_idx:
                json_str = text[start_idx:end_idx]
                return json.loads(json_str)
        except json.JSONDecodeError as e:
            print(f"❌ {context} JSON parse error: {e}")
            print(f"Text sample: {text[:200]}...")
        
        return fallback
    
    @track_performance
    async def retry_with_backoff(self, func, max_retries: int = 3, agent_name: str = "Agent"):
        """Retry with exponential backoff"""
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # Apply rate limiting
                await self.rate_limiter.wait_if_needed()
                
                # Execute function
                if asyncio.iscoroutinefunction(func):
                    result = await func()
                else:
                    # Run synchronous function in thread pool
                    loop = asyncio.get_event_loop()
                    result = await loop.run_in_executor(None, func)
                
                return result
                
            except Exception as e:
                last_error = e
                print(f"❌ {agent_name} attempt {attempt + 1}/{max_retries} failed: {str(e)}")
                
                if attempt < max_retries - 1:
                    # Exponential backoff
                    delay = (2 ** attempt) * 1.0  # seconds
                    if "rate limit" in str(e).lower() or "429" in str(e):
                        delay *= 2  # Longer delay for rate limits
                    
                    print(f"⏳ Retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
        
        raise last_error or Exception(f"{agent_name} failed after {max_retries} retries")

# ============================================================================
# SPECIALIZED AGENTS
# ============================================================================

class AdmissionExtractionAgent(BaseAgent):
    """Extracts structured data from admission letters"""
    
    @async_cache(ttl=3600, key_prefix="extraction")
    async def extract(self, cloudinary_url: str, file_type: str) -> ExtractionResult:
        """Extract data from admission letter"""
        print("🔍 Admission Extraction Agent analyzing document...")
        
        current_year = datetime.now().year
        prompt = f"""You are an expert at analyzing university admission and offer letters.

Analyze this {file_type} admission/offer letter and extract structured information.

Document URL: {cloudinary_url}

Return ONLY valid JSON:
{{
  "university_name": "string or null",
  "program_name": "string or null",
  "intake_term": "Fall|Spring|Summer|Winter or null",
  "intake_year": number ({current_year}-{current_year + 5}) or null,
  "country": "string or null",
  "city": "string or null",
  "degree_level": "Bachelor|Master|PhD|Diploma|Certificate or null",
  "duration": "string or null",
  "tuition_fee": "string or null",
  "scholarship_mentioned": boolean,
  "documents_required": ["array of strings"],
  "deadlines": {{
    "acceptance_deadline": "string or null",
    "enrollment_deadline": "string or null",
    "fee_payment_deadline": "string or null"
  }},
  "extraction_metadata": {{
    "document_quality": "excellent|good|fair|poor",
    "fields_extracted": number,
    "confidence": number (0-100),
    "readability_issues": ["array of strings"]
  }}
}}

EXTRACTION RULES:
1. Extract text EXACTLY as shown
2. Set to null if not clearly visible
3. scholarship_mentioned: true only if explicitly mentioned
4. documents_required: List only if explicitly mentioned
5. Assess document quality based on clarity
6. Count non-null critical fields

Be thorough and accurate. If uncertain, use null."""
        
        client = self.agent_pool.get_gemini()
        message = HumanMessage(content=prompt)
        
        async def execute_extraction():
            response = await client.ainvoke([message])
            text = self.extract_text(response)
            data = self.safe_json_parse(text, {}, "AdmissionExtractionAgent")
            
            # Validate minimum data
            critical_fields = ["university_name", "program_name", "intake_year", "country"]
            extracted_fields = sum(1 for field in critical_fields if data.get(field))
            
            if extracted_fields == 0:
                raise ValueError("No data extracted from admission letter")
            
            print(f"✅ Extracted {extracted_fields} critical fields")
            return ExtractionResult(**data)
        
        return await self.retry_with_backoff(
            execute_extraction, max_retries=3, agent_name="AdmissionExtractionAgent"
        )

class AdmissionValidationAgent(BaseAgent):
    """Validates extracted admission letter data"""
    
    @async_cache(ttl=1800, key_prefix="validation")
    async def validate(self, extraction_result: ExtractionResult) -> ValidationResult:
        """Validate extracted data"""
        print("✅ Admission Validation Agent checking data integrity...")
        
        current_year = datetime.now().year
        data_dict = asdict(extraction_result)
        
        prompt = f"""You are an admission document validation specialist.

Validate the extracted admission letter data for correctness and consistency.

Extracted Data:
{json.dumps(data_dict, indent=2)}

Return ONLY valid JSON:
{{
  "valid": boolean,
  "overall_confidence": "high|medium|low",
  "field_validation": {{
    "university_name": {{"valid": boolean, "issues": ["array"]}},
    "program_name": {{"valid": boolean, "issues": ["array"]}},
    "intake_year": {{"valid": boolean, "issues": ["array"]}},
    "country": {{"valid": boolean, "issues": ["array"]}}
  }},
  "document_authenticity": {{
    "appear_authentic": boolean,
    "red_flags": ["array"],
    "missing_critical_info": ["array"]
  }},
  "critical_issues": ["array"],
  "warnings": ["array"],
  "recommendations": ["array"]
}}

VALIDATION RULES:
1. University Name: Should be a recognized institution
2. Program Name: Should include degree type
3. Intake Year: Must be {current_year} or later, not more than 3 years in future
4. Country: Must be a valid country name
5. At least 3 critical fields must be present
6. Check for suspicious patterns

Analyze thoroughly. Mark as invalid only if critical concerns."""
        
        client = self.agent_pool.get_groq()
        message = HumanMessage(content=prompt)
        
        async def execute_validation():
            response = await client.ainvoke([message])
            text = self.extract_text(response)
            data = self.safe_json_parse(text, {}, "AdmissionValidationAgent")
            
            if not data or "valid" not in data:
                raise ValueError("Invalid validation response")
            
            print(f"✅ Validation: {'VALID' if data.get('valid') else 'INVALID'}")
            return ValidationResult(**data)
        
        return await self.retry_with_backoff(
            execute_validation, max_retries=3, agent_name="AdmissionValidationAgent"
        )

class AdmissionRiskAssessmentAgent(BaseAgent):
    """Assesses university and loan risk"""
    
    @async_cache(ttl=1800, key_prefix="risk")
    async def assess_risk(self, extraction_result: ExtractionResult, validation_result: ValidationResult) -> RiskAssessment:
        """Perform risk assessment"""
        print("🔐 Admission Risk Assessment Agent analyzing...")
        
        prompt = f"""You are a university admission risk assessment specialist for education loan applications.

Perform comprehensive risk assessment of this admission letter for loan approval.

Extracted Data:
{json.dumps(asdict(extraction_result), indent=2)}

Validation Result:
{json.dumps(asdict(validation_result), indent=2)}

Return ONLY valid JSON:
{{
  "verified": boolean,
  "verification_level": "high|medium|low|failed",
  "university_score": number (0-100),
  "risk_level": "low|medium|high",
  "confidence": number (0-100),
  "reason": "string",
  "university_reputation": {{
    "is_recognized": boolean,
    "accreditation_status": "accredited|questionable|unknown",
    "reputation_notes": "string"
  }},
  "loan_approval_factors": {{
    "program_viability": "strong|moderate|weak",
    "country_reputation": "favorable|neutral|concerning",
    "tuition_reasonable": "yes|no|unknown",
    "employability_prospects": "high|medium|low"
  }},
  "issues_found": ["array"],
  "strengths": ["array"],
  "nbfc_recommendations": ["array"]
}}

SCORING GUIDE:
- 80-100: Top-tier, low risk, high loan approval
- 60-79: Good, medium risk, moderate approval
- 40-59: Average, higher risk, needs documentation
- 0-39: Questionable, high risk, likely rejection

Provide comprehensive risk assessment focusing on loan approval viability."""
        
        client = self.agent_pool.get_groq()
        message = HumanMessage(content=prompt)
        
        async def execute_assessment():
            response = await client.ainvoke([message])
            text = self.extract_text(response)
            data = self.safe_json_parse(text, {}, "AdmissionRiskAssessmentAgent")
            
            if not data or "verified" not in data:
                raise ValueError("Invalid risk assessment response")
            
            print(f"✅ Risk assessment: Score {data.get('university_score', 0)}/100")
            return RiskAssessment(**data)
        
        return await self.retry_with_backoff(
            execute_assessment, max_retries=3, agent_name="AdmissionRiskAssessmentAgent"
        )

class AdmissionImprovementAgent(BaseAgent):
    """Generates improvement recommendations"""
    
    async def generate_recommendations(
        self,
        extraction_result: ExtractionResult,
        validation_result: ValidationResult,
        risk_assessment: RiskAssessment
    ) -> ImprovementRecommendations:
        """Generate improvement recommendations"""
        print("💡 Admission Improvement Agent generating recommendations...")
        
        prompt = f"""You are an education loan application advisor.

Analyze the admission letter data and provide ACTIONABLE recommendations.

Current State:
- University: {extraction_result.university_name or "Unknown"}
- Country: {extraction_result.country or "Unknown"}
- Program: {extraction_result.program_name or "Unknown"}
- Validation: {'Valid' if validation_result.valid else 'Invalid'}
- Risk Level: {risk_assessment.risk_level}
- University Score: {risk_assessment.university_score}/100

Return ONLY valid JSON:
{{
  "improvement_score": number (0-100),
  "current_strength": "excellent|strong|moderate|weak|poor",
  "immediate_actions": [
    {{"priority": number, "action": "string", "reason": "string", 
      "estimated_impact": "high|medium|low", "estimated_time": "string"}}
  ],
  "document_quality_improvements": ["array"],
  "additional_documents_suggested": ["array"],
  "nbfc_specific_tips": ["array"],
  "alternative_options": ["array"],
  "estimated_loan_approval_chance": "high|medium|low",
  "estimated_time_to_ready": "string"
}}

Provide specific, actionable steps to improve loan approval chances."""
        
        client = self.agent_pool.get_groq()
        message = HumanMessage(content=prompt)
        
        async def execute_recommendations():
            response = await client.ainvoke([message])
            text = self.extract_text(response)
            data = self.safe_json_parse(text, {}, "AdmissionImprovementAgent")
            
            if not data:
                data = {
                    "improvement_score": 50,
                    "current_strength": "moderate",
                    "immediate_actions": [],
                    "document_quality_improvements": [],
                    "additional_documents_suggested": [],
                    "nbfc_specific_tips": [],
                    "alternative_options": [],
                    "estimated_loan_approval_chance": "medium",
                    "estimated_time_to_ready": "1 day"
                }
            
            print(f"✅ Generated {len(data.get('immediate_actions', []))} recommendations")
            return ImprovementRecommendations(**data)
        
        return await self.retry_with_backoff(
            execute_recommendations, max_retries=3, agent_name="AdmissionImprovementAgent"
        )

# ============================================================================
# ORCHESTRATOR WITH MULTI-THREADING
# ============================================================================

class AdmissionLetterWorkflowOrchestrator:
    """Orchestrates multi-agent workflow with parallel execution"""
    
    _initialized = False
    _thread_pool = ThreadPoolExecutor(max_workers=10)
    
    @classmethod
    def initialize(cls):
        """Initialize the orchestrator"""
        if not cls._initialized:
            AgentPool().initialize()
            cls._initialized = True
            print("✅ Admission Letter Workflow Orchestrator initialized")
    
    @classmethod
    def is_initialized(cls) -> bool:
        """Check if orchestrator is initialized"""
        return cls._initialized
    
    @classmethod
    @track_performance
    async def process_admission_letter(
        cls,
        cloudinary_url: str,
        file_type: str,
        enable_improvements: bool = True
    ) -> ProcessResult:
        """Process admission letter asynchronously"""
        start_time = time.time()
        
        try:
            cls.initialize()
            
            # Create agents
            extraction_agent = AdmissionExtractionAgent()
            validation_agent = AdmissionValidationAgent()
            risk_agent = AdmissionRiskAssessmentAgent()
            improvement_agent = AdmissionImprovementAgent()
            
            print("📊 Phase 1: Extracting admission letter data...")
            
            # Phase 1: Extraction (can be done in parallel with other tasks if needed)
            extraction_result = await extraction_agent.extract(cloudinary_url, file_type)
            
            if not extraction_result.university_name and not extraction_result.program_name:
                raise ValueError("No meaningful data extracted from admission letter")
            
            # Phase 2 & 3: Run validation and risk assessment in parallel
            print("✅ Phase 2 & 3: Parallel validation and risk assessment...")
            
            # Create tasks for parallel execution
            validation_task = validation_agent.validate(extraction_result)
            risk_task = risk_agent.assess_risk(extraction_result, ValidationResult())
            
            # Execute in parallel
            validation_result, risk_assessment = await asyncio.gather(
                validation_task,
                risk_task,
                return_exceptions=True
            )
            
            # Check for exceptions
            if isinstance(validation_result, Exception):
                raise validation_result
            if isinstance(risk_assessment, Exception):
                raise risk_assessment
            
            # Phase 4: Improvement recommendations (conditional)
            improvement_recommendations = None
            if enable_improvements and (not risk_assessment.verified or risk_assessment.university_score < 70):
                print("💡 Phase 4: Generating improvement recommendations...")
                improvement_recommendations = await improvement_agent.generate_recommendations(
                    extraction_result, validation_result, risk_assessment
                )
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            print(f"✅ Admission Letter Workflow completed in {duration_ms}ms")
            print(f"   - University: {extraction_result.university_name or 'Unknown'}")
            print(f"   - Program: {extraction_result.program_name or 'Unknown'}")
            print(f"   - Validation: {'PASS' if validation_result.valid else 'FAIL'}")
            print(f"   - Risk: {risk_assessment.risk_level.upper()}")
            print(f"   - Score: {risk_assessment.university_score}/100")
            
            return ProcessResult(
                extraction_result=extraction_result,
                validation_result=validation_result,
                risk_assessment=risk_assessment,
                improvement_recommendations=improvement_recommendations,
                metadata={
                    "processing_time_ms": duration_ms,
                    "file_type": file_type,
                    "agents_used": 4 if improvement_recommendations else 3,
                    "timestamp": datetime.utcnow().isoformat(),
                    "cache_hit": False
                }
            )
            
        except Exception as e:
            print(f"❌ Admission Letter Workflow failed: {str(e)}")
            raise
    
    @classmethod
    def process_admission_letter_sync(
        cls,
        cloudinary_url: str,
        file_type: str,
        enable_improvements: bool = True
    ) -> Dict[str, Any]:
        """Synchronous wrapper for compatibility with multiprocessing"""
        try:
            # Run async function in event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            result = loop.run_until_complete(
                cls.process_admission_letter(cloudinary_url, file_type, enable_improvements)
            )
            
            loop.close()
            
            # Convert to dict for serialization
            return {
                "success": True,
                "result": asdict(result),
                "error": None
            }
            
        except Exception as e:
            return {
                "success": False,
                "result": None,
                "error": str(e)
            }

# ============================================================================
# PUBLIC API
# ============================================================================

async def process_admission_letter_v2(
    cloudinary_url: str,
    file_type: str,
    enable_improvements: bool = True
) -> ProcessResult:
    """Public API for processing admission letters"""
    return await AdmissionLetterWorkflowOrchestrator.process_admission_letter(
        cloudinary_url, file_type, enable_improvements
    )

def process_admission_letter_v2_sync(
    cloudinary_url: str,
    file_type: str,
    enable_improvements: bool = True
) -> Dict[str, Any]:
    """Synchronous public API"""
    return AdmissionLetterWorkflowOrchestrator.process_admission_letter_sync(
        cloudinary_url, file_type, enable_improvements
    )

# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "AdmissionLetterWorkflowOrchestrator",
    "process_admission_letter_v2",
    "process_admission_letter_v2_sync",
    "ExtractionResult",
    "ValidationResult",
    "RiskAssessment",
    "ImprovementRecommendations",
    "ProcessResult",
    "AdmissionExtractionAgent",
    "AdmissionValidationAgent",
    "AdmissionRiskAssessmentAgent",
    "AdmissionImprovementAgent",
]