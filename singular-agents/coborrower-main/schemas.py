from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime


class FOIRResult(BaseModel):
    """Enhanced FOIR Calculation Result"""
    foir: float = Field(description="FOIR percentage (0-100)")
    monthly_income: float = Field(description="Net monthly income")
    monthly_emi: float = Field(description="Total monthly EMI")
    status: str = Field(description="low/medium/high/critical")

    # Additional metrics
    available_income: Optional[float] = Field(
        default=None, description="Income after EMI")
    emi_to_income_ratio: Optional[float] = Field(
        default=None, description="Same as FOIR, for clarity")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "foir": 45.5,
                "monthly_income": 75000.0,
                "monthly_emi": 34125.0,
                "status": "medium",
                "available_income": 40875.0
            }
        }
    )


class CIBILEstimate(BaseModel):
    """Enhanced CIBIL Score Estimation with Insights"""
    estimated_band: str = Field(description="e.g., 700-749")
    estimated_score: int = Field(description="Midpoint estimate (300-900)")
    risk_level: str = Field(
        description="low/medium_low/medium/medium_high/high")

    # Optional insights
    insights: Optional[Dict] = Field(
        default=None, description="Detailed scoring insights")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "estimated_band": "700-749",
                "estimated_score": 725,
                "risk_level": "medium_low",
                "insights": {
                    "score_range": "700-750",
                    "primary_factors": ["Clean payment history"],
                    "red_flags": ["High FOIR"],
                    "approval_likelihood": "Good (70-80%)"
                }
            }
        }
    )


class ExtractionMetadata(BaseModel):
    """Metadata about extraction quality"""
    confidence: float = Field(description="Confidence score 0-1", ge=0, le=1)
    data_sources: List[str] = Field(
        default_factory=list, description="Which docs were used")
    warnings: List[str] = Field(
        default_factory=list, description="Extraction warnings")


class FinancialResult(BaseModel):
    """Final Output - FOIR + CIBIL with Metadata"""
    session_id: str
    timestamp: datetime = Field(default_factory=datetime.now)

    # Core Results
    foir: Optional[FOIRResult] = Field(default=None)
    cibil: Optional[CIBILEstimate] = Field(default=None)

    # Metadata
    processing_time_seconds: float
    status: str = Field(description="success/partial/failed")
    errors: List[str] = Field(default_factory=list)

    # Enhanced metadata
    extraction_quality: Optional[ExtractionMetadata] = Field(default=None)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "session_id": "abc123",
                "timestamp": "2024-12-18T10:30:00",
                "foir": {
                    "foir": 45.5,
                    "monthly_income": 75000.0,
                    "monthly_emi": 34125.0,
                    "status": "medium"
                },
                "cibil": {
                    "estimated_band": "700-749",
                    "estimated_score": 725,
                    "risk_level": "medium_low"
                },
                "processing_time_seconds": 12.5,
                "status": "success",
                "errors": []
            }
        }
    )
