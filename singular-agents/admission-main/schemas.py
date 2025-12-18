from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

# ========== DOCUMENT TYPE ENUM ==========


class DocumentType(str):
    """Document types for admission letters"""
    ADMISSION_LETTER = "admission_letter"  # MANDATORY
    OFFER_LETTER = "offer_letter"  # MANDATORY
    I20 = "i20"  # Optional (USA)
    COE = "coe"  # Optional (Certificate of Enrollment)
    CAS = "cas"  # Optional (UK)
    LOA = "loa"  # Optional (Canada)
    FEE_RECEIPT = "fee_receipt"  # Optional
    SCHOLARSHIP_LETTER = "scholarship_letter"  # Optional
    CONDITIONAL_OFFER = "conditional_offer"  # Optional
    UNCONDITIONAL_OFFER = "unconditional_offer"  # Optional
    OTHER = "other"  # Optional

# ========== ADMISSION LETTER SCHEMA ==========


class AdmissionLetter(BaseModel):
    """Single admission letter entry"""
    university_name: Optional[str] = Field(
        default=None, description="University/Institution name")
    program_name: Optional[str] = Field(
        default=None, description="Program/Course name")
    degree_level: Literal["bachelor", "master", "phd", "diploma", "certificate", "associate", "other"] = Field(
        default="other", description="Degree level")

    intake_term: Optional[str] = Field(
        default=None, description="Intake term (Fall/Spring/Summer/Winter)")
    intake_year: Optional[int] = Field(default=None, description="Intake year")

    country: Optional[str] = Field(
        default=None, description="Country of university")
    city: Optional[str] = Field(default=None, description="City of university")
    duration: Optional[str] = Field(
        default=None, description="Program duration (e.g., '2 years', '4 semesters')")

    tuition_fee: Optional[float] = Field(
        default=None, description="Annual tuition fee amount")
    tuition_currency: Optional[str] = Field(
        default="USD", description="Currency of tuition fee")
    scholarship_amount: Optional[float] = Field(
        default=None, description="Scholarship/Financial aid amount")
    scholarship_mentioned: bool = Field(
        default=False, description="Is scholarship mentioned")

    acceptance_deadline: Optional[str] = Field(
        default=None, description="Acceptance deadline (DD/MM/YYYY)")
    enrollment_deadline: Optional[str] = Field(
        default=None, description="Enrollment deadline (DD/MM/YYYY)")
    fee_payment_deadline: Optional[str] = Field(
        default=None, description="Fee payment deadline (DD/MM/YYYY)")

    student_id: Optional[str] = Field(
        default=None, description="Student ID if mentioned")
    application_id: Optional[str] = Field(
        default=None, description="Application ID if mentioned")

    conditional_admission: bool = Field(
        default=False, description="Is this a conditional admission")
    conditions: Optional[List[str]] = Field(
        default=None, description="Conditions for admission (if conditional)")
    documents_required: Optional[List[str]] = Field(
        default=None, description="Documents required for enrollment")

    extraction_confidence: float = Field(
        default=0.0, description="Extraction confidence (0-1)")
    document_quality: float = Field(
        default=0.0, description="Document quality score (0-1)")
    notes: Optional[str] = Field(default=None, description="Extraction notes")

    # Source document information
    source_document_type: str = Field(
        default="admission_letter", description="Type of source document")
    has_admission_letter: bool = Field(
        default=False, description="Has mandatory admission/offer letter")

# ========== VERIFICATION SCHEMA ==========


class VerificationResult(BaseModel):
    """Verification result for admission letter"""
    valid: bool = Field(default=False, description="Is the entry valid")
    confidence: Literal["high", "medium", "low"] = Field(
        default="low", description="Confidence level")
    reason: str = Field(default="", description="Validation reason")
    issues: List[str] = Field(default_factory=list,
                              description="Validation issues")
    warnings: List[str] = Field(default_factory=list, description="Warnings")
    has_mandatory_documents: bool = Field(
        default=False, description="Has admission/offer letter (mandatory)")

# ========== DOCUMENT INFO SCHEMA ==========


class DocumentInfo(BaseModel):
    """Document metadata"""
    filename: str = Field(description="Document filename")
    path: str = Field(description="Document path")
    extension: str = Field(description="File extension")
    size_mb: float = Field(description="File size in MB")
    page_count: int = Field(default=0, description="Number of pages")
    quality_score: float = Field(
        default=0.0, description="Document quality (0-1)")
    document_type: str = Field(default="other", description="Type of document")
    is_mandatory: bool = Field(
        default=False, description="Is this a mandatory document")

# ========== COMPLETE ADMISSION RECORD ==========


class AdmissionLetterRecord(BaseModel):
    """Complete admission letter record for a student"""
    session_id: str = Field(description="Unique session ID")
    processing_timestamp: datetime = Field(default_factory=datetime.now)

    # Admission letters
    admission_letters: List[AdmissionLetter] = Field(default_factory=list)
    verifications: List[VerificationResult] = Field(default_factory=list)
    documents: List[DocumentInfo] = Field(default_factory=list)

    # Summary statistics
    total_documents: int = Field(
        default=0, description="Total documents processed")
    mandatory_documents_count: int = Field(
        default=0, description="Number of admission/offer letters")
    optional_documents_count: int = Field(
        default=0, description="Number of optional documents")
    valid_admissions: int = Field(
        default=0, description="Valid admission letters")

    # University information
    universities: List[str] = Field(
        default_factory=list, description="List of universities")
    countries: List[str] = Field(
        default_factory=list, description="List of countries")

    # Mandatory document validation
    has_all_mandatory_documents: bool = Field(
        default=False, description="Has all required admission/offer letters")
    missing_mandatory_documents: List[str] = Field(
        default_factory=list, description="Missing admission/offer letters")

    # Metadata
    processing_time_seconds: Optional[float] = None
    status: Literal["success", "partial", "failed"] = "success"
    errors: List[str] = Field(default_factory=list)
