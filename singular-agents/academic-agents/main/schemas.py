from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


# ========== CLASS 10 SCHEMA ==========
class Class10Marksheet(BaseModel):
    """10th marksheet data"""
    board_name: str = Field(
        description="Board name (CBSE, ICSE, State Board, etc.)")
    year_of_passing: int = Field(description="Year of passing")
    school_name: Optional[str] = Field(default=None, description="School name")

    # Marks can be percentage OR grade
    percentage: Optional[float] = Field(
        default=None, description="Overall percentage (if available)")
    cgpa: Optional[float] = Field(
        default=None, description="CGPA (if available)")
    grade: Optional[str] = Field(
        default=None, description="Grade (if available)")

    # Will be calculated
    converted_grade: Optional[str] = Field(
        default=None, description="Converted to standard grade")


# ========== CLASS 12 SCHEMA ==========
class Class12Marksheet(BaseModel):
    """12th marksheet data"""
    board_name: str = Field(description="Board name")
    year_of_passing: int = Field(description="Year of passing")
    stream: Optional[str] = Field(
        default=None, description="Stream (Science/Commerce/Arts)")
    school_name: Optional[str] = Field(default=None, description="School name")
    
    # Marks
    percentage: Optional[float] = Field(
        default=None, description="Overall percentage")
    cgpa: Optional[float] = Field(default=None, description="CGPA")
    grade: Optional[str] = Field(default=None, description="Grade")

    # Will be calculated
    converted_grade: Optional[str] = Field(
        default=None, description="Converted to standard grade")


# ========== GRADUATION SCHEMAS ==========
class GraduationSemester(BaseModel):
    """Single semester/year data - ADDED THIS CLASS"""
    semester_year: str = Field(
        description="Semester/Year identifier (e.g., 'Semester 1', 'Year 1')")
    year_of_completion: Optional[int] = Field(
        default=None, description="Year this semester was completed")
    percentage: Optional[float] = Field(
        default=None, description="Percentage marks")
    cgpa: Optional[float] = Field(
        default=None, description="CGPA/SGPA")
    grade: Optional[str] = Field(
        default=None, description="Grade obtained")


class GraduationMarksheet(BaseModel):
    """Complete graduation data"""
    institution_name: str = Field(description="College/University name")
    degree: str = Field(description="Degree (B.Tech, B.Sc, etc.)")
    specialization: Optional[str] = Field(
        default=None, description="Branch/Specialization")
    year_of_passing: int = Field(description="Final year of passing")
    duration_years: Optional[int] = Field(
        default=None, description="Duration in years")

    # All semesters/years
    semesters: List[GraduationSemester] = Field(
        description="All semester marksheets")

    # Overall
    final_percentage: Optional[float] = Field(
        default=None, description="Final percentage")
    final_cgpa: Optional[float] = Field(default=None, description="Final CGPA")
    converted_grade: Optional[str] = Field(
        default=None, description="Converted to standard grade")


# ========== CERTIFICATE SCHEMAS ==========
class Certificate(BaseModel):
    """Certificate information"""
    certificate_name: str = Field(description="Name of certificate")
    issuing_organization: str = Field(description="Who issued it")
    issue_date: Optional[str] = Field(default=None, description="Issue date")
    authenticity_score: int = Field(
        default=0, description="Authenticity score (0-10)")


class Certificates(BaseModel):
    """All certificates"""
    certificates: List[Certificate] = Field(
        description="List of all certificates")


# ========== GAP ANALYSIS SCHEMA ==========
class EducationGap(BaseModel):
    """Education gap information"""
    gap_type: Literal["after_10th", "after_12th", "during_graduation"] = Field(
        description="Type of gap"
    )
    gap_years: float = Field(description="Duration of gap in years")
    from_education: str = Field(description="Education completed before gap")
    to_education: str = Field(description="Education started after gap")
    is_significant: bool = Field(
        description="Is this a significant gap (>1 year)")
    explanation: str = Field(description="Human-readable explanation")


class GapAnalysis(BaseModel):
    """Complete gap analysis"""
    has_gaps: bool = Field(description="Are there any education gaps")
    total_gaps: int = Field(description="Number of gaps detected")
    gaps: List[EducationGap] = Field(description="List of all gaps")
    overall_assessment: str = Field(description="Overall timeline assessment")
    timeline_consistent: bool = Field(description="Is timeline logical")


# ========== FINAL OUTPUT SCHEMA ==========
class StudentAcademicRecord(BaseModel):
    """Complete student academic record"""
    student_id: str = Field(description="Unique session ID")
    processing_timestamp: datetime = Field(default_factory=datetime.now)

    # Academic data
    class_10: Optional[Class10Marksheet] = None
    class_12: Optional[Class12Marksheet] = None
    graduation: Optional[GraduationMarksheet] = None
    certificates: Optional[Certificates] = None

    # Analysis
    gap_analysis: Optional[GapAnalysis] = None

    # Metadata
    processing_time_seconds: Optional[float] = None
    status: Literal["success", "partial", "failed"] = "success"
    errors: List[str] = Field(default_factory=list)