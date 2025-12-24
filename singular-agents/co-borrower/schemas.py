"""
Complete Pydantic schemas for structured LLM output - PRODUCTION READY
✅ These schemas guarantee valid JSON from Gemini 2.0 Flash
"""
from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum

# ============================================================================
# ENUMS
# ============================================================================


class FOIRStatus(str, Enum):
    """FOIR status categories"""
    EXCELLENT = "excellent"      # < 40%
    GOOD = "good"                # 40-50%
    ACCEPTABLE = "acceptable"    # 50-65%
    HIGH = "high"                # 65-80%
    CRITICAL = "critical"        # > 80%


class RiskLevel(str, Enum):
    """Credit risk levels"""
    EXCELLENT = "excellent"      # 750-900
    GOOD = "good"                # 700-749
    FAIR = "fair"                # 650-699
    POOR = "poor"                # 550-649
    VERY_POOR = "very_poor"      # 300-549


class IncomeTrend(str, Enum):
    """Income trend over years"""
    INCREASING = "increasing"
    STABLE = "stable"
    DECREASING = "decreasing"
    INSUFFICIENT_DATA = "insufficient_data"

# ============================================================================
# BANK STATEMENT SCHEMAS
# ============================================================================


class BankTransaction(BaseModel):
    """Individual bank transaction"""
    date: str = Field(
        description="Transaction date (DD-MM-YYYY or DD/MM/YYYY)")
    narration: str = Field(description="Transaction description")
    debit: float = Field(default=0.0, ge=0.0, description="Debit amount")
    credit: float = Field(default=0.0, ge=0.0, description="Credit amount")
    balance: float = Field(default=0.0, ge=0.0,
                           description="Balance after transaction")


class BankStatementExtraction(BaseModel):
    """Schema for structured bank statement extraction by LLM"""
    account_holder_name: str = Field(
        default="", description="Account holder's name")
    bank_name: str = Field(default="", description="Bank name")
    account_number: str = Field(default="", description="Account number")
    account_type: str = Field(
        default="", description="Account type (Savings/Current)")
    statement_period_start: str = Field(
        default="", description="Statement start date (YYYY-MM-DD)")
    statement_period_end: str = Field(
        default="", description="Statement end date (YYYY-MM-DD)")
    opening_balance: float = Field(default=0.0, description="Opening balance")
    closing_balance: float = Field(default=0.0, description="Closing balance")
    transactions: List[BankTransaction] = Field(
        default_factory=list, description="All transactions")
    extraction_confidence: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Confidence score")
    extraction_notes: List[str] = Field(
        default_factory=list, description="Extraction notes")


class BankStatementData(BaseModel):
    """Complete bank statement data with computed metrics"""
    account_holder_name: str
    bank_name: str
    account_number: str
    account_type: str
    statement_period_start: str
    statement_period_end: str
    opening_balance: float
    closing_balance: float

    # Computed metrics
    average_monthly_balance: float = 0.0
    minimum_balance: float = 0.0
    salary_credits_detected: int = 0
    average_monthly_salary: float = 0.0
    salary_consistency_months: int = 0
    last_salary_date: Optional[str] = None
    total_emi_debits: float = 0.0
    average_monthly_emi: float = 0.0
    emi_transactions: List[dict] = Field(default_factory=list)
    unique_loan_accounts: int = 0
    total_credits: float = 0.0
    total_debits: float = 0.0
    credit_count: int = 0
    debit_count: int = 0
    average_monthly_spending: float = 0.0

    # Bounce/Dishonor metrics
    bounce_count: int = 0
    dishonor_count: int = 0
    insufficient_fund_incidents: int = 0

    # Analysis
    red_flags: List[str] = Field(default_factory=list)
    positive_indicators: List[str] = Field(default_factory=list)
    transactions: List[BankTransaction] = Field(default_factory=list)
    extraction_confidence: float = 0.0
    extraction_notes: List[str] = Field(default_factory=list)

# ============================================================================
# SALARY SLIP SCHEMAS
# ============================================================================


class MonthlySalary(BaseModel):
    """Monthly salary details"""
    month: str = Field(description="Month (e.g., 'October 2024')")
    gross_salary: float = Field(
        default=0.0, ge=0.0, description="Gross salary")
    net_salary: float = Field(
        default=0.0, ge=0.0, description="Net take-home salary")
    total_deductions: float = Field(
        default=0.0, ge=0.0, description="Total deductions")
    basic_salary: float = Field(
        default=0.0, ge=0.0, description="Basic salary")
    hra: float = Field(default=0.0, ge=0.0, description="House Rent Allowance")
    other_allowances: float = Field(
        default=0.0, ge=0.0, description="Other allowances")
    pf_deduction: float = Field(
        default=0.0, ge=0.0, description="PF deduction")
    tax_deduction: float = Field(
        default=0.0, ge=0.0, description="TDS/Tax deduction")


class SalarySlipExtraction(BaseModel):
    """Schema for structured salary slip extraction by LLM"""
    employee_name: str = Field(default="", description="Employee name")
    employee_id: str = Field(default="", description="Employee ID")
    designation: str = Field(default="", description="Designation/Job title")
    department: str = Field(default="", description="Department")
    employer_name: str = Field(default="", description="Company/Employer name")
    company_address: str = Field(default="", description="Company address")
    monthly_salaries: List[MonthlySalary] = Field(
        default_factory=list, description="Monthly salary breakdown")
    average_gross_salary: float = Field(
        default=0.0, ge=0.0, description="Average gross salary")
    average_net_salary: float = Field(
        default=0.0, ge=0.0, description="Average net salary")
    average_deductions: float = Field(
        default=0.0, ge=0.0, description="Average deductions")
    salary_consistency_months: int = Field(
        default=0, ge=0, description="Number of months with salary")
    last_salary_month: str = Field(
        default="", description="Most recent salary month")
    extraction_confidence: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Confidence score")
    extraction_notes: List[str] = Field(
        default_factory=list, description="Extraction notes")


class SalarySlipData(BaseModel):
    """Complete salary slip data"""
    employee_name: str
    employee_id: str
    designation: str
    department: str
    employer_name: str
    company_address: str
    monthly_salaries: List[MonthlySalary]
    average_gross_salary: float
    average_net_salary: float
    average_deductions: float
    salary_consistency_months: int
    last_salary_month: str
    extraction_confidence: float
    extraction_notes: List[str]

# ============================================================================
# ITR SCHEMAS
# ============================================================================


class YearlyITRData(BaseModel):
    """ITR data for a single year"""
    assessment_year: str = Field(
        description="Assessment year (e.g., '2023-24')")
    gross_total_income: float = Field(
        default=0.0, ge=0.0, description="Gross total income")
    total_income_after_deductions: float = Field(
        default=0.0, ge=0.0, description="Income after deductions")
    tax_paid: float = Field(default=0.0, ge=0.0, description="Total tax paid")
    filing_date: str = Field(default="", description="ITR filing date")
    filing_status: str = Field(
        default="", description="Filing status (filed/verified)")
    salary_income: float = Field(
        default=0.0, ge=0.0, description="Salary income")
    business_income: float = Field(
        default=0.0, ge=0.0, description="Business income")
    other_income: float = Field(
        default=0.0, ge=0.0, description="Other income")


class ITRExtraction(BaseModel):
    """Schema for structured ITR extraction by LLM"""
    taxpayer_name: str = Field(default="", description="Taxpayer name")
    pan_number: str = Field(default="", description="PAN number")
    yearly_data: List[YearlyITRData] = Field(
        default_factory=list, description="Year-wise ITR data")
    years_filed: int = Field(
        default=0, ge=0, description="Number of years filed")
    average_annual_income: float = Field(
        default=0.0, ge=0.0, description="Average annual income")
    average_monthly_income: float = Field(
        default=0.0, ge=0.0, description="Average monthly income")
    income_trend: IncomeTrend = Field(
        default=IncomeTrend.INSUFFICIENT_DATA, description="Income trend")
    tax_compliance_score: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Tax compliance score")
    extraction_confidence: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Confidence score")
    extraction_notes: List[str] = Field(
        default_factory=list, description="Extraction notes")


class ITRData(BaseModel):
    """Complete ITR data"""
    taxpayer_name: str
    pan_number: str
    yearly_data: List[YearlyITRData]
    years_filed: int
    average_annual_income: float
    average_monthly_income: float
    income_trend: IncomeTrend
    tax_compliance_score: float
    extraction_confidence: float
    extraction_notes: List[str]

# ============================================================================
# FOIR SCHEMAS
# ============================================================================


class FOIRResult(BaseModel):
    """FOIR calculation result"""
    foir_percentage: float = Field(ge=0.0, description="FOIR percentage")
    foir_status: FOIRStatus = Field(description="FOIR status category")
    monthly_net_income: float = Field(ge=0.0, description="Monthly net income")
    total_monthly_emi: float = Field(
        ge=0.0, description="Total monthly EMI obligations")
    available_monthly_income: float = Field(
        description="Available income after EMI")
    income_source: str = Field(description="Primary income source used")
    income_source_confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence in income source")
    emi_source: str = Field(description="EMI source (bank statement)")
    cross_validation_notes: List[str] = Field(
        default_factory=list, description="Cross-validation observations")
    calculation_confidence: float = Field(
        ge=0.0, le=1.0, description="Overall calculation confidence")

# ============================================================================
# CIBIL SCHEMAS
# ============================================================================


class CIBILEstimate(BaseModel):
    """CIBIL score estimation"""
    estimated_score: int = Field(
        ge=300, le=900, description="Estimated CIBIL score (300-900)")
    risk_level: RiskLevel = Field(description="Credit risk level")
    confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence in estimation")
    positive_factors: List[str] = Field(
        default_factory=list, description="Factors contributing positively")
    negative_factors: List[str] = Field(
        default_factory=list, description="Factors contributing negatively")
    recommendations: List[str] = Field(
        default_factory=list, description="Recommendations for improvement")
    estimation_basis: str = Field(description="Basis of estimation")

# ============================================================================
# MAIN ANALYSIS SCHEMA
# ============================================================================


class LoanApplicationAnalysis(BaseModel):
    """Complete loan application analysis result"""
    session_id: str
    timestamp: datetime

    # Extracted data
    itr_data: Optional[ITRData] = None
    bank_data: Optional[BankStatementData] = None
    salary_data: Optional[SalarySlipData] = None

    # Calculations
    foir_result: Optional[FOIRResult] = None
    cibil_estimate: Optional[CIBILEstimate] = None

    # Quality metrics
    overall_confidence: float = Field(ge=0.0, le=1.0)
    data_sources_used: List[str] = Field(default_factory=list)
    missing_data: List[str] = Field(default_factory=list)

    # Processing metadata
    processing_time_seconds: float
    status: str  # success/partial/failed
    errors: List[str] = Field(default_factory=list)
