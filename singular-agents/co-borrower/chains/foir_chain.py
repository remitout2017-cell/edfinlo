"""
FOIR Chain - PRODUCTION READY with Structured Output
✅ NO JSON PARSING ERRORS
"""
import logging
from typing import Optional
from chains.base_chain import BaseChain
from schemas import ITRData, BankStatementData, SalarySlipData, FOIRResult

logger = logging.getLogger(__name__)


class FOIRChain(BaseChain):
    """Calculate FOIR using structured output"""

    def __init__(self):
        super().__init__(model_name="gemini-2.0-flash-exp", temperature=0.0)

    def _create_calculation_prompt(
        self,
        itr_data: Optional[ITRData],
        bank_data: Optional[BankStatementData],
        salary_data: Optional[SalarySlipData]
    ) -> str:
        """Create prompt for FOIR calculation"""

        context = """Calculate the Fixed Obligations to Income Ratio (FOIR) based on the following data:

"""

        # Add available data
        if salary_data:
            context += f"""**Salary Slip Data:**
- Average Net Salary: ₹{salary_data.average_net_salary:,.2f}
- Salary Consistency: {salary_data.salary_consistency_months} months
- Employer: {salary_data.employer_name}

"""

        if itr_data:
            context += f"""**ITR Data:**
- Average Annual Income: ₹{itr_data.average_annual_income:,.2f}
- Average Monthly Income: ₹{itr_data.average_monthly_income:,.2f}
- Years Filed: {itr_data.years_filed}

"""

        if bank_data:
            context += f"""**Bank Statement Data:**
- Average Monthly Salary (detected): ₹{bank_data.average_monthly_salary:,.2f}
- Average Monthly EMI: ₹{bank_data.average_monthly_emi:,.2f}
- EMI Transactions: {len(bank_data.emi_transactions)}
- Unique Loan Accounts: {bank_data.unique_loan_accounts}

"""

        context += """**FOIR Calculation Rules:**
1. Determine most reliable monthly net income (prefer: Salary Slips > Bank Statement > ITR)
2. Calculate total monthly EMI obligations from bank statement
3. FOIR = (Total Monthly EMI / Monthly Net Income) × 100
4. FOIR Status:
   - Excellent: < 40%
   - Good: 40-50%
   - Acceptable: 50-65%
   - High: 65-80%
   - Critical: > 80%

Provide:
- Monthly net income (chosen source and rationale)
- Total monthly EMI
- FOIR percentage
- FOIR status
- Available monthly income after EMI
- Data sources used with confidence
- Cross-validation notes

The system will validate your response automatically."""

        return context

    def calculate_foir(
        self,
        itr_data: Optional[ITRData],
        bank_data: Optional[BankStatementData],
        salary_data: Optional[SalarySlipData]
    ) -> Optional[FOIRResult]:
        """
        Calculate FOIR with structured output.

        Args:
            itr_data: ITR analysis
            bank_data: Bank statement analysis
            salary_data: Salary slip analysis

        Returns:
            FOIRResult with validated data
        """
        logger.info("💵 Calculating FOIR...")

        if not any([itr_data, bank_data, salary_data]):
            logger.warning(
                "  ⚠️ No financial data available for FOIR calculation")
            return None

        try:
            prompt = self._create_calculation_prompt(
                itr_data, bank_data, salary_data)
            messages = self.create_gemini_content(prompt, [])

            # ✅ Invoke with structured output
            foir_result = self.invoke_structured_with_retry(
                messages,
                schema=FOIRResult
            )

            logger.info(f"  ✅ FOIR: {foir_result.foir_percentage}%")
            logger.info(f"  📊 Status: {foir_result.foir_status.value}")
            logger.info(
                f"  💰 Monthly Income: ₹{foir_result.monthly_net_income:,.2f}")
            logger.info(
                f"  💳 Monthly EMI: ₹{foir_result.total_monthly_emi:,.2f}")

            return foir_result

        except Exception as e:
            logger.error(f"  ❌ FOIR calculation failed: {e}")
            return None