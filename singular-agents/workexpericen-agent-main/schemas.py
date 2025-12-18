from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


# ========== DOCUMENT TYPE ENUM ==========
class DocumentType(str):
    """Document types for work experience"""
    EXPERIENCE_LETTER = "experience_letter"  # MANDATORY
    OFFER_LETTER = "offer_letter"            # Optional
    RELIEVING_LETTER = "relieving_letter"    # Optional
    SALARY_SLIP = "salary_slip"              # Optional
    APPOINTMENT_LETTER = "appointment_letter"  # Optional
    OTHER = "other"                          # Optional


# ========== WORK EXPERIENCE SCHEMA ==========
class WorkExperience(BaseModel):
    """Single work experience entry"""
    company_name: Optional[str] = Field(
        default=None, description="Company name")
    job_title: Optional[str] = Field(
        default=None, description="Job title/position")
    employment_type: Literal[
        "full_time", "part_time", "contract",
        "internship_paid", "internship_unpaid",
        "freelance", "volunteer", "temporary"
    ] = Field(default="full_time", description="Type of employment")

    start_date: Optional[str] = Field(
        default=None, description="Start date (DD/MM/YYYY)")
    end_date: Optional[str] = Field(
        default=None, description="End date (DD/MM/YYYY)")
    currently_working: bool = Field(
        default=False, description="Currently working here")

    is_paid: bool = Field(default=True, description="Is this paid work")
    stipend_amount: Optional[float] = Field(
        default=None, description="Salary/stipend amount")

    extraction_confidence: float = Field(
        default=0.0, description="Extraction confidence (0-1)")
    document_quality: float = Field(
        default=0.0, description="Document quality score (0-1)")
    notes: Optional[str] = Field(default=None, description="Extraction notes")

    # NEW: Source document information
    source_document_type: str = Field(
        default="experience_letter", description="Type of source document")
    has_experience_letter: bool = Field(
        default=False, description="Has mandatory experience letter")


# ========== VERIFICATION SCHEMA ==========
class VerificationResult(BaseModel):
    """Verification result for work experience"""
    valid: bool = Field(default=False, description="Is the entry valid")
    confidence: Literal["high", "medium", "low"] = Field(
        default="low", description="Confidence level")
    reason: str = Field(default="", description="Validation reason")
    issues: List[str] = Field(default_factory=list,
                              description="Validation issues")
    warnings: List[str] = Field(default_factory=list, description="Warnings")
    has_mandatory_documents: bool = Field(
        default=False, description="Has experience letter (mandatory)")


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


# ========== COMPLETE WORK RECORD ==========
class WorkExperienceRecord(BaseModel):
    """Complete work experience record for a person"""
    session_id: str = Field(description="Unique session ID")
    processing_timestamp: datetime = Field(default_factory=datetime.now)

    # Work experiences
    work_experiences: List[WorkExperience] = Field(default_factory=list)
    verifications: List[VerificationResult] = Field(default_factory=list)
    documents: List[DocumentInfo] = Field(default_factory=list)

    # Summary statistics
    total_documents: int = Field(
        default=0, description="Total documents processed")
    mandatory_documents_count: int = Field(
        default=0, description="Number of experience letters")
    optional_documents_count: int = Field(
        default=0, description="Number of optional documents")
    valid_experiences: int = Field(
        default=0, description="Valid work experiences")
    total_years_experience: Optional[float] = Field(
        default=None, description="Total years of experience")

    # Mandatory document validation
    has_all_mandatory_documents: bool = Field(
        default=False, description="Has all required experience letters")
    missing_mandatory_documents: List[str] = Field(
        default_factory=list, description="Missing experience letters")

    # Metadata
    processing_time_seconds: Optional[float] = None
    status: Literal["success", "partial", "failed"] = "success"
    errors: List[str] = Field(default_factory=list)
