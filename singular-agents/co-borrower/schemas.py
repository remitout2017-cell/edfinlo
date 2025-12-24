"""
Complete Pydantic schemas - FULLY CORRECTED v2
✅ Fixed @model_validator syntax for Pydantic v2
✅ Proper auto-calculation of averages
✅ Comprehensive validation
"""

from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator
from enum import Enum
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# ENUMS
# ============================================================================


class FOIRStatus(str, Enum):
    """FOIR status categories"""
    EXCELLENT = "excellent"
    GOOD = "good"
    ACCEPTABLE = "acceptable"
    HIGH = "high"
    CRITICAL = "critical"


class RiskLevel(str, Enum):
    """Credit risk levels"""
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    VERY_POOR = "very_poor"


class IncomeTrend(str, Enum):
    """Income trend over years"""
    INCREASING = "increasing"
    STABLE = "stable"
    DECREASING = "decreasing"
    INSUFFICIENT_DATA = "insufficient_data"


# ============================================================================
# SALARY SLIP SCHEMAS
# ============================================================================

class MonthlySalary(BaseModel):
    """Monthly salary details"""
    month: str = Field(description="Month (e.g., 'October 2024')")
    gross_salary: float = Field(default=0.0, ge=0.0)
    net_salary: float = Field(default=0.0, ge=0.0)
    total_deductions: float = Field(default=0.0, ge=0.0)
    basic_salary: float = Field(default=0.0, ge=0.0)
    hra: float = Field(default=0.0, ge=0.0)
    other_allowances: float = Field(default=0.0, ge=0.0)
    pf_deduction: float = Field(default=0.0, ge=0.0)
    tax_deduction: float = Field(default=0.0, ge=0.0)


class SalarySlipExtraction(BaseModel):
    """Schema for structured salary slip extraction by LLM"""
    employee_name: str = Field(default="")
    employee_id: str = Field(default="")
    designation: str = Field(default="")
    department: str = Field(default="")
    employer_name: str = Field(default="")
    company_address: str = Field(default="")
    monthly_salaries: List[MonthlySalary] = Field(default_factory=list)

    # These will be auto-calculated
    average_gross_salary: float = Field(default=0.0, ge=0.0)
    average_net_salary: float = Field(default=0.0, ge=0.0)
    average_deductions: float = Field(default=0.0, ge=0.0)
    salary_consistency_months: int = Field(default=0, ge=0)
    last_salary_month: str = Field(default="")

    extraction_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    extraction_notes: List[str] = Field(default_factory=list)

    @model_validator(mode='after')
    def calculate_salary_averages(self) -> 'SalarySlipExtraction':
        """Calculate averages from monthly_salaries"""
        if self.monthly_salaries and len(self.monthly_salaries) > 0:
            logger.debug(
                f"Calculating salary averages from {len(self.monthly_salaries)} months")

            # Calculate averages
            gross_total = sum(m.gross_salary for m in self.monthly_salaries)
            net_total = sum(m.net_salary for m in self.monthly_salaries)
            deduction_total = sum(
                m.total_deductions for m in self.monthly_salaries)
            count = len(self.monthly_salaries)

            self.average_gross_salary = round(gross_total / count, 2)
            self.average_net_salary = round(net_total / count, 2)
            self.average_deductions = round(deduction_total / count, 2)
            self.salary_consistency_months = count
            self.last_salary_month = self.monthly_salaries[-1].month

            # Auto-set confidence based on data quality
            if count >= 3 and self.average_net_salary > 0:
                self.extraction_confidence = 0.9
            elif count >= 1 and self.average_net_salary > 0:
                self.extraction_confidence = 0.7

            logger.debug(
                f"✅ Calculated: avg_net={self.average_net_salary}, confidence={self.extraction_confidence}")
        else:
            logger.warning("⚠️ No monthly_salaries data to calculate averages")

        return self


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
    gross_total_income: float = Field(default=0.0, ge=0.0)
    total_income_after_deductions: float = Field(default=0.0, ge=0.0)
    tax_paid: float = Field(default=0.0, ge=0.0)
    filing_date: str = Field(default="")
    filing_status: str = Field(default="")
    salary_income: float = Field(default=0.0, ge=0.0)
    business_income: float = Field(default=0.0, ge=0.0)
    other_income: float = Field(default=0.0, ge=0.0)


class ITRExtraction(BaseModel):
    """Schema for structured ITR extraction by LLM"""
    taxpayer_name: str = Field(default="")
    pan_number: str = Field(default="")
    yearly_data: List[YearlyITRData] = Field(default_factory=list)

    # These will be auto-calculated
    years_filed: int = Field(default=0, ge=0)
    average_annual_income: float = Field(default=0.0, ge=0.0)
    average_monthly_income: float = Field(default=0.0, ge=0.0)
    income_trend: IncomeTrend = Field(default=IncomeTrend.INSUFFICIENT_DATA)
    tax_compliance_score: float = Field(default=0.0, ge=0.0, le=1.0)

    extraction_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    extraction_notes: List[str] = Field(default_factory=list)

    @model_validator(mode='after')
    def calculate_itr_metrics(self) -> 'ITRExtraction':
        """Calculate ITR metrics from yearly_data"""
        if self.yearly_data and len(self.yearly_data) > 0:
            logger.debug(
                f"Calculating ITR metrics from {len(self.yearly_data)} years")

            self.years_filed = len(self.yearly_data)

            # Calculate average annual income
            incomes = [
                y.gross_total_income for y in self.yearly_data if y.gross_total_income > 0]
            if incomes:
                self.average_annual_income = round(
                    sum(incomes) / len(incomes), 2)
                self.average_monthly_income = round(
                    self.average_annual_income / 12, 2)

            # Determine income trend
            if len(self.yearly_data) >= 2:
                sorted_years = sorted(
                    self.yearly_data, key=lambda x: x.assessment_year)
                first_income = sorted_years[0].gross_total_income
                last_income = sorted_years[-1].gross_total_income

                if last_income > first_income * 1.1:
                    self.income_trend = IncomeTrend.INCREASING
                elif last_income < first_income * 0.9:
                    self.income_trend = IncomeTrend.DECREASING
                else:
                    self.income_trend = IncomeTrend.STABLE

            # Tax compliance score
            if self.years_filed >= 2:
                self.tax_compliance_score = min(1.0, self.years_filed / 2)

            # Auto-set confidence
            if self.years_filed >= 2 and self.average_annual_income > 0:
                self.extraction_confidence = 0.9
            elif self.years_filed >= 1 and self.average_annual_income > 0:
                self.extraction_confidence = 0.7

            logger.debug(
                f"✅ Calculated: avg_annual={self.average_annual_income}, years={self.years_filed}")
        else:
            logger.warning("⚠️ No yearly_data to calculate ITR metrics")

        return self


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
# BANK STATEMENT SCHEMAS
# ============================================================================

class BankTransaction(BaseModel):
    """Individual bank transaction"""
    date: str
    narration: str
    debit: float = Field(default=0.0, ge=0.0)
    credit: float = Field(default=0.0, ge=0.0)
    balance: float = Field(default=0.0, ge=0.0)


class BankStatementExtraction(BaseModel):
    """Schema for structured bank statement extraction by LLM"""
    account_holder_name: str = Field(default="")
    bank_name: str = Field(default="")
    account_number: str = Field(default="")
    account_type: str = Field(default="")
    statement_period_start: str = Field(default="")
    statement_period_end: str = Field(default="")
    opening_balance: float = Field(default=0.0)
    closing_balance: float = Field(default=0.0)
    transactions: List[BankTransaction] = Field(default_factory=list)
    extraction_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    extraction_notes: List[str] = Field(default_factory=list)

    @model_validator(mode='after')
    def filter_invalid_transactions(self) -> 'BankStatementExtraction':
        """Filter out invalid transactions"""
        if self.transactions:
            # Filter transactions with balance > 0
            valid_txns = [t for t in self.transactions if t.balance > 0]
            logger.debug(
                f"Filtered {len(self.transactions)} -> {len(valid_txns)} valid transactions")
            self.transactions = valid_txns

            # Set confidence
            if len(valid_txns) >= 10:
                self.extraction_confidence = 0.9
            elif len(valid_txns) >= 5:
                self.extraction_confidence = 0.7
            else:
                self.extraction_confidence = 0.5

        return self


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
    bounce_count: int = 0
    dishonor_count: int = 0
    insufficient_fund_incidents: int = 0

    red_flags: List[str] = Field(default_factory=list)
    positive_indicators: List[str] = Field(default_factory=list)
    transactions: List[BankTransaction] = Field(default_factory=list)
    extraction_confidence: float = 0.0
    extraction_notes: List[str] = Field(default_factory=list)


# ============================================================================
# CIBIL SCHEMAS
# ============================================================================

class CreditAccount(BaseModel):
    """Individual credit account from CIBIL report"""
    account_type: str = Field(default="")
    bank_name: str = Field(default="")
    account_number: str = Field(default="")
    sanctioned_amount: float = Field(default=0.0, ge=0.0)
    current_balance: float = Field(default=0.0, ge=0.0)
    payment_status: str = Field(default="")
    dpd_days: int = Field(default=0, ge=0)


class CIBILReportExtraction(BaseModel):
    """Schema for CIBIL report extraction"""
    applicant_name: str = Field(default="")
    pan_number: str = Field(default="")
    cibil_score: int = Field(ge=300, le=900)
    score_date: str = Field(default="")
    total_accounts: int = Field(default=0, ge=0)
    active_accounts: int = Field(default=0, ge=0)
    closed_accounts: int = Field(default=0, ge=0)
    total_overdue_amount: float = Field(default=0.0, ge=0.0)
    credit_inquiries_last_30_days: int = Field(default=0, ge=0)
    oldest_account_age_months: int = Field(default=0, ge=0)
    credit_accounts: List[CreditAccount] = Field(default_factory=list)
    total_credit_limit: float = Field(default=0.0, ge=0.0)
    total_outstanding: float = Field(default=0.0, ge=0.0)
    credit_utilization_percent: float = Field(default=0.0, ge=0.0, le=100.0)
    extraction_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    extraction_notes: List[str] = Field(default_factory=list)


class CIBILReportData(BaseModel):
    """Complete CIBIL report data"""
    applicant_name: str
    pan_number: str
    cibil_score: int
    score_date: str
    total_accounts: int
    active_accounts: int
    closed_accounts: int
    total_overdue_amount: float
    credit_inquiries_last_30_days: int
    oldest_account_age_months: int
    credit_accounts: List[CreditAccount]
    total_credit_limit: float
    total_outstanding: float
    credit_utilization_percent: float
    extraction_confidence: float
    extraction_notes: List[str]


# ============================================================================
# FOIR & ANALYSIS SCHEMAS
# ============================================================================

class FOIRResult(BaseModel):
    """FOIR calculation result"""
    foir_percentage: float = Field(ge=0.0)
    foir_status: FOIRStatus
    monthly_net_income: float = Field(ge=0.0)
    total_monthly_emi: float = Field(ge=0.0)
    available_monthly_income: float
    income_source: str
    income_source_confidence: float = Field(ge=0.0, le=1.0)
    emi_source: str
    cross_validation_notes: List[str] = Field(default_factory=list)
    calculation_confidence: float = Field(ge=0.0, le=1.0)
    calculation_method: str = Field(default="groq_llm")


class CIBILEstimate(BaseModel):
    """CIBIL score estimation"""
    estimated_score: int = Field(ge=300, le=900)
    risk_level: RiskLevel
    confidence: float = Field(ge=0.0, le=1.0)
    positive_factors: List[str] = Field(default_factory=list)
    negative_factors: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    estimation_basis: str


class AggregatedUserData(BaseModel):
    """Aggregated user financial data"""
    session_id: str
    timestamp: datetime
    processing_status: str = "processing"
    salary_data: Optional[SalarySlipData] = None
    itr_data: Optional[ITRData] = None
    cibil_report: Optional[CIBILReportData] = None
    bank_data: Optional[BankStatementData] = None


class LoanApplicationAnalysis(BaseModel):
    """Complete loan application analysis"""
    session_id: str
    timestamp: datetime
    salary_data: Optional[SalarySlipData] = None
    itr_data: Optional[ITRData] = None
    cibil_report: Optional[CIBILReportData] = None
    bank_data: Optional[BankStatementData] = None
    foir_result: Optional[FOIRResult] = None
    cibil_estimate: Optional[CIBILEstimate] = None
    overall_confidence: float
    data_sources_used: List[str]
    missing_data: List[str]
    processing_time_seconds: float
    status: str
    errors: List[str] = Field(default_factory=list)
