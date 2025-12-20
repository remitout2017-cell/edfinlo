from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from enum import Enum


class TestType(str, Enum):
    TOEFL = "toefl"
    GRE = "gre"
    IELTS = "ielts"


class TOEFLScore(BaseModel):
    """TOEFL score breakdown"""
    reading: Optional[int] = Field(None, ge=0, le=30)
    listening: Optional[int] = Field(None, ge=0, le=30)
    speaking: Optional[int] = Field(None, ge=0, le=30)
    writing: Optional[int] = Field(None, ge=0, le=30)
    total_score: Optional[int] = Field(None, ge=0, le=120)

    test_date: Optional[date] = None
    registration_number: Optional[str] = None
    test_center: Optional[str] = None
    score_validity_date: Optional[date] = None


class GREScore(BaseModel):
    """GRE score breakdown"""
    verbal_reasoning: Optional[int] = Field(None, ge=130, le=170)
    quantitative_reasoning: Optional[int] = Field(None, ge=130, le=170)
    analytical_writing: Optional[float] = Field(None, ge=0.0, le=6.0)

    test_date: Optional[date] = None
    registration_number: Optional[str] = None
    test_center: Optional[str] = None
    score_validity_date: Optional[date] = None


class IELTSScore(BaseModel):
    """IELTS score breakdown"""
    listening: Optional[float] = Field(None, ge=0.0, le=9.0)
    reading: Optional[float] = Field(None, ge=0.0, le=9.0)
    writing: Optional[float] = Field(None, ge=0.0, le=9.0)
    speaking: Optional[float] = Field(None, ge=0.0, le=9.0)
    overall_band_score: Optional[float] = Field(None, ge=0.0, le=9.0)

    test_date: Optional[date] = None
    candidate_number: Optional[str] = None
    test_center: Optional[str] = None
    test_report_form_number: Optional[str] = None


class TestScoreRecord(BaseModel):
    """Main record for test score extraction"""
    session_id: str
    test_type: TestType

    # Student info
    candidate_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    email: Optional[str] = None

    # Score data (only one will be populated based on test_type)
    toefl_score: Optional[TOEFLScore] = None
    gre_score: Optional[GREScore] = None
    ielts_score: Optional[IELTSScore] = None

    # Document metadata
    document_filename: Optional[str] = None
    document_path: Optional[str] = None
    extraction_confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    # Processing metadata
    status: str = "pending"  # pending, success, failed, partial
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    processing_time_seconds: float = 0.0
    extracted_at: datetime = Field(default_factory=datetime.now)

    # Verification
    is_verified: bool = False
    verification_issues: List[str] = Field(default_factory=list)

    # Raw extraction metadata
    extraction_metadata: Optional[Dict[str, Any]] = None


class VerificationResult(BaseModel):
    """Verification result for test scores"""
    valid: bool
    confidence_score: float = Field(ge=0.0, le=1.0)
    issues: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    score_validity_check: bool = True
    date_validity_check: bool = True
