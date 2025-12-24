"""
FOIR Chain with Groq - PRODUCTION READY with Enhanced Accuracy
✅ Uses Groq for accurate FOIR calculation from aggregated data
"""

import logging
from typing import Optional
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential
from config import Config
from schemas import (
    SalarySlipData, ITRData, BankStatementData,
    FOIRResult, FOIRStatus
)

logger = logging.getLogger(__name__)


class FOIRChainWithGroq:
    """Calculate FOIR using Groq for maximum accuracy"""

    def __init__(self):
        """Initialize Groq LLM"""
        try:
            self.llm = ChatGroq(
                model="llama-3.3-70b-versatile",  # Most accurate model
                api_key=Config.GROQ_API_KEY,
                temperature=0.0,
                max_tokens=8192
            )
            logger.info("✅ Initialized FOIR Chain with Groq (llama-3.3-70b)")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Groq: {e}")
            raise

    def _create_foir_prompt(
        self,
        salary_data: Optional[SalarySlipData],
        itr_data: Optional[ITRData],
        bank_data: Optional[BankStatementData]
    ) -> str:
        """Create comprehensive prompt for FOIR calculation"""

        prompt = """You are a financial analyst calculating Fixed Obligation to Income Ratio (FOIR) for loan assessment.

FOIR = (Total Monthly EMI / Monthly Net Income) × 100

You have access to multiple data sources. Use cross-validation to find the most accurate values.

**AVAILABLE DATA:**

"""

        # Add salary slip data
        if salary_data:
            prompt += f"""**SALARY SLIP DATA:**
- Employee: {salary_data.employee_name}
- Employer: {salary_data.employer_name}
- Average Gross Salary: ₹{salary_data.average_gross_salary:,.2f}
- Average Net Salary: ₹{salary_data.average_net_salary:,.2f}
- Average Deductions: ₹{salary_data.average_deductions:,.2f}
- Salary Consistency: {salary_data.salary_consistency_months} months
- Last Salary Month: {salary_data.last_salary_month}

"""

        # Add ITR data
        if itr_data:
            prompt += f"""**ITR DATA:**
- Taxpayer: {itr_data.taxpayer_name}
- PAN: {itr_data.pan_number}
- Average Annual Income: ₹{itr_data.average_annual_income:,.2f}
- Average Monthly Income: ₹{itr_data.average_monthly_income:,.2f}
- Years Filed: {itr_data.years_filed}
- Income Trend: {itr_data.income_trend.value}

"""

        # Add bank statement data
        if bank_data:
            prompt += f"""**BANK STATEMENT DATA:**
- Account Holder: {bank_data.account_holder_name}
- Bank: {bank_data.bank_name}
- Statement Period: {bank_data.statement_period_start} to {bank_data.statement_period_end}
- Average Monthly Balance: ₹{bank_data.average_monthly_balance:,.2f}
- Average Monthly Salary (detected): ₹{bank_data.average_monthly_salary:,.2f}
- Salary Credits Detected: {bank_data.salary_credits_detected}
- Average Monthly EMI: ₹{bank_data.average_monthly_emi:,.2f}
- Total EMI Debits: ₹{bank_data.total_emi_debits:,.2f}
- Unique Loan Accounts: {bank_data.unique_loan_accounts}
- Bounce Count: {bank_data.bounce_count}
- Dishonor Count: {bank_data.dishonor_count}

"""

        prompt += """**YOUR TASK:**

1. **Determine Monthly Net Income** (choose the most reliable source):
   - Priority 1: Salary slip average net salary (most recent and accurate)
   - Priority 2: Bank statement salary credits (actual credited amount)
   - Priority 3: ITR average monthly income (annual average)
   - Use cross-validation to verify consistency

2. **Determine Total Monthly EMI**:
   - Use bank statement average monthly EMI (most accurate)
   - This includes ALL loan EMIs (home, personal, auto, credit cards)

3. **Calculate FOIR**:
   - FOIR % = (Total Monthly EMI / Monthly Net Income) × 100
   - Round to 2 decimal places

4. **Determine FOIR Status**:
   - EXCELLENT: < 40%
   - GOOD: 40-50%
   - ACCEPTABLE: 50-65%
   - HIGH: 65-80%
   - CRITICAL: > 80%

5. **Calculate Available Monthly Income**:
   - Available Income = Monthly Net Income - Total Monthly EMI

6. **Provide Cross-Validation Notes**:
   - Mention if income sources are consistent
   - Flag any discrepancies
   - Note confidence level

**CRITICAL RULES:**
- Be conservative: use the LOWER income value if sources conflict
- Be accurate: use ACTUAL EMI from bank statement, not estimated
- Show your reasoning in cross_validation_notes
- Set calculation_confidence based on data quality and consistency

Return your analysis in structured JSON format matching the FOIRResult schema."""

        return prompt

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def calculate_foir(
        self,
        salary_data: Optional[SalarySlipData],
        itr_data: Optional[ITRData],
        bank_data: Optional[BankStatementData]
    ) -> Optional[FOIRResult]:
        """
        Calculate FOIR using Groq LLM with all available data.

        Args:
            salary_data: Extracted salary slip data
            itr_data: Extracted ITR data
            bank_data: Extracted bank statement data

        Returns:
            FOIRResult with accurate calculation
        """
        if not any([salary_data, itr_data, bank_data]):
            logger.warning("⚠️ No data available for FOIR calculation")
            return None

        logger.info("💵 Calculating FOIR using Groq LLM...")

        try:
            # Create prompt
            prompt = self._create_foir_prompt(salary_data, itr_data, bank_data)

            # Create structured LLM
            structured_llm = self.llm.with_structured_output(FOIRResult)

            # Invoke
            messages = [HumanMessage(content=prompt)]
            result = structured_llm.invoke(messages)

            logger.info(f"   ✅ FOIR Calculated: {result.foir_percentage:.2f}%")
            logger.info(f"   📊 Status: {result.foir_status.value.upper()}")
            logger.info(
                f"   💰 Monthly Income: ₹{result.monthly_net_income:,.2f}")
            logger.info(f"   💳 Monthly EMI: ₹{result.total_monthly_emi:,.2f}")
            logger.info(
                f"   💵 Available Income: ₹{result.available_monthly_income:,.2f}")
            logger.info(
                f"   🎯 Confidence: {result.calculation_confidence:.0%}")

            return result

        except Exception as e:
            logger.error(f"   ❌ FOIR calculation failed: {e}")
            # Fallback to simple calculation
            return self._fallback_foir_calculation(salary_data, itr_data, bank_data)

    def _fallback_foir_calculation(
        self,
        salary_data: Optional[SalarySlipData],
        itr_data: Optional[ITRData],
        bank_data: Optional[BankStatementData]
    ) -> Optional[FOIRResult]:
        """Fallback deterministic FOIR calculation"""
        logger.warning("⚠️ Using fallback FOIR calculation")

        # Determine income
        monthly_income = 0.0
        income_source = "none"

        if salary_data and salary_data.average_net_salary > 0:
            monthly_income = salary_data.average_net_salary
            income_source = "salary_slip"
        elif bank_data and bank_data.average_monthly_salary > 0:
            monthly_income = bank_data.average_monthly_salary
            income_source = "bank_statement"
        elif itr_data and itr_data.average_monthly_income > 0:
            monthly_income = itr_data.average_monthly_income
            income_source = "itr"

        # Determine EMI
        monthly_emi = 0.0
        if bank_data and bank_data.average_monthly_emi > 0:
            monthly_emi = bank_data.average_monthly_emi

        # Calculate FOIR
        if monthly_income > 0:
            foir_pct = (monthly_emi / monthly_income) * 100
        else:
            foir_pct = 0.0

        # Determine status
        if foir_pct < 40:
            status = FOIRStatus.EXCELLENT
        elif foir_pct < 50:
            status = FOIRStatus.GOOD
        elif foir_pct < 65:
            status = FOIRStatus.ACCEPTABLE
        elif foir_pct < 80:
            status = FOIRStatus.HIGH
        else:
            status = FOIRStatus.CRITICAL

        return FOIRResult(
            foir_percentage=round(foir_pct, 2),
            foir_status=status,
            monthly_net_income=monthly_income,
            total_monthly_emi=monthly_emi,
            available_monthly_income=monthly_income - monthly_emi,
            income_source=income_source,
            income_source_confidence=0.6,
            emi_source="bank_statement" if bank_data else "none",
            cross_validation_notes=["Fallback calculation used"],
            calculation_confidence=0.5,
            calculation_method="fallback_deterministic"
        )
