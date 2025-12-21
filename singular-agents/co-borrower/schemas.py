"""Pydantic schemas for structured outputs - analytics-first and crash-resistant.

Key hardening:
- All numeric fields accept None from LLM and are coerced to 0.0/0.
- Schemas remain stable even when extraction is partial.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum


class EmploymentType(str, Enum):
    SALARIED = "salaried"
    SELF_EMPLOYED = "self_employed"
    BUSINESS = "business"
    PROFESSIONAL = "professional"
    UNEMPLOYED = "unemployed"


class FOIRStatus(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class CIBILRiskLevel(str, Enum):
    LOW = "low"
    MEDIUM_LOW = "medium_low"
    MEDIUM = "medium"
    MEDIUM_HIGH = "medium_high"
    HIGH = "high"


def _none_to_float(v):
    if v is None or v == "" or v == "null":
        return 0.0
    return v


def _none_to_int(v):
    if v is None or v == "" or v == "null":
        return 0
    return v


# ========== ITR EXTRACTION SCHEMA ==========
class ITRData(BaseModel):
    applicant_name: str = Field(description="Full name of the applicant")
    pan_number: Optional[str] = Field(None, description="PAN number")

    assessment_year_1: str
    assessment_year_2: str

    gross_total_income_year1: float
    deductions_year1: float = 0.0
    taxable_income_year1: float
    tax_paid_year1: float = 0.0

    gross_total_income_year2: float
    deductions_year2: float = 0.0
    taxable_income_year2: float
    tax_paid_year2: float = 0.0

    average_annual_income: float = 0.0
    average_monthly_income: float = 0.0
    income_growth_rate: float = 0.0

    itr_form_type: str
    filing_status: str

    extraction_confidence: float = Field(ge=0, le=1)
    extraction_notes: List[str] = Field(default_factory=list)

    # Coerce Nones coming from LLM
    _num_fix = field_validator(
        'gross_total_income_year1', 'deductions_year1', 'taxable_income_year1', 'tax_paid_year1',
        'gross_total_income_year2', 'deductions_year2', 'taxable_income_year2', 'tax_paid_year2',
        'average_annual_income', 'average_monthly_income', 'income_growth_rate',
        mode='before'
    )(_none_to_float)

    @field_validator('average_annual_income', mode='after')
    def calc_avg_annual(cls, v, info):
        # If LLM returned 0 but has incomes, compute average
        data = info.data
        if v and v > 0:
            return v
        return (data.get('gross_total_income_year1', 0.0) + data.get('gross_total_income_year2', 0.0)) / 2

    @field_validator('average_monthly_income', mode='after')
    def calc_avg_monthly(cls, v, info):
        data = info.data
        if v and v > 0:
            return v
        return (data.get('average_annual_income', 0.0) / 12) if data.get('average_annual_income', 0.0) else 0.0


# ========== BANK STATEMENT EXTRACTION SCHEMA ==========
class BankStatementData(BaseModel):
    account_holder_name: str
    bank_name: str
    account_number: str
    account_type: str
    statement_period_start: str
    statement_period_end: str

    opening_balance: float = 0.0
    closing_balance: float = 0.0
    average_monthly_balance: float = 0.0
    minimum_balance: float = 0.0

    salary_credits_detected: int = 0
    average_monthly_salary: float = 0.0
    salary_consistency_months: int = 0
    last_salary_date: Optional[str] = None

    total_emi_debits: float = 0.0
    average_monthly_emi: float = 0.0
    emi_transactions: List[Dict] = Field(default_factory=list)
    unique_loan_accounts: int = 0

    bounce_count: int = 0
    dishonor_count: int = 0
    insufficient_fund_incidents: int = 0

    total_credits: float = 0.0
    total_debits: float = 0.0
    credit_count: int = 0
    debit_count: int = 0

    average_monthly_spending: float = 0.0
    high_value_transactions: List[Dict] = Field(default_factory=list)

    red_flags: List[str] = Field(default_factory=list)
    positive_indicators: List[str] = Field(default_factory=list)

    extraction_confidence: float = Field(ge=0, le=1)
    extraction_notes: List[str] = Field(default_factory=list)

    _float_fix = field_validator(
        'opening_balance', 'closing_balance', 'average_monthly_balance', 'minimum_balance',
        'average_monthly_salary', 'total_emi_debits', 'average_monthly_emi',
        'total_credits', 'total_debits', 'average_monthly_spending',
        mode='before'
    )(_none_to_float)

    _int_fix = field_validator(
        'salary_credits_detected', 'salary_consistency_months', 'unique_loan_accounts',
        'bounce_count', 'dishonor_count', 'insufficient_fund_incidents', 'credit_count', 'debit_count',
        mode='before'
    )(_none_to_int)


# ========== SALARY SLIP EXTRACTION SCHEMA ==========
class SalarySlipData(BaseModel):
    employee_name: str
    employee_id: Optional[str] = None
    employer_name: str
    designation: Optional[str] = None
    employment_type: EmploymentType

    month_1_date: str
    month_1_gross: float
    month_1_deductions: float
    month_1_net: float

    month_2_date: str
    month_2_gross: float
    month_2_deductions: float
    month_2_net: float

    month_3_date: str
    month_3_gross: float
    month_3_deductions: float
    month_3_net: float

    average_gross_salary: float = 0.0
    average_net_salary: float = 0.0
    average_deductions: float = 0.0

    basic_salary: float = 0.0
    hra: float = 0.0
    special_allowance: float = 0.0
    other_allowances: float = 0.0

    pf_deduction: float = 0.0
    professional_tax: float = 0.0
    tds: float = 0.0

    salary_consistency: float = Field(ge=0, le=1, default=0.0)
    has_salary_growth: bool = False

    extraction_confidence: float = Field(ge=0, le=1)
    extraction_notes: List[str] = Field(default_factory=list)

    _float_fix = field_validator(
        'month_1_gross', 'month_1_deductions', 'month_1_net',
        'month_2_gross', 'month_2_deductions', 'month_2_net',
        'month_3_gross', 'month_3_deductions', 'month_3_net',
        'average_gross_salary', 'average_net_salary', 'average_deductions',
        'basic_salary', 'hra', 'special_allowance', 'other_allowances',
        'pf_deduction', 'professional_tax', 'tds', 'salary_consistency',
        mode='before'
    )(_none_to_float)


# ========== FOIR (analytics only) ==========
class FOIRResult(BaseModel):
    foir_percentage: float
    foir_status: FOIRStatus
    monthly_gross_income: float
    monthly_net_income: float
    total_monthly_emi: float
    available_monthly_income: float
    emi_to_income_ratio: float
    debt_service_coverage_ratio: float


# ========== CIBIL (analytics only) ==========
class CIBILEstimate(BaseModel):
    estimated_score: int = Field(ge=300, le=900)
    estimated_band: str
    risk_level: CIBILRiskLevel

    payment_history_score: float
    credit_utilization_score: float
    income_stability_score: float
    credit_mix_score: float

    positive_factors: List[str] = Field(default_factory=list)
    negative_factors: List[str] = Field(default_factory=list)
    risk_indicators: List[str] = Field(default_factory=list)


# ========== FINAL OUTPUT ==========
class LoanApplicationAnalysis(BaseModel):
    session_id: str
    timestamp: datetime = Field(default_factory=datetime.now)

    itr_data: Optional[ITRData] = None
    bank_data: Optional[BankStatementData] = None
    salary_data: Optional[SalarySlipData] = None

    foir_result: Optional[FOIRResult] = None
    cibil_estimate: Optional[CIBILEstimate] = None

    overall_confidence: float = Field(ge=0, le=1)
    data_sources_used: List[str] = Field(default_factory=list)
    missing_data: List[str] = Field(default_factory=list)

    processing_time_seconds: float
    status: str
    errors: List[str] = Field(default_factory=list)
