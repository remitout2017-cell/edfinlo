"""
CIBIL Chain - PRODUCTION READY with Structured Output
✅ NO JSON PARSING ERRORS - Estimates CIBIL based on bank data
"""
import logging
from typing import Optional
from chains.base_chain import BaseChain
from schemas import BankStatementData, FOIRResult, CIBILEstimate

logger = logging.getLogger(__name__)


class CIBILChain(BaseChain):
    """Estimate CIBIL score using structured output"""

    def __init__(self):
        super().__init__(model_name="gemini-2.0-flash-exp", temperature=0.0)

    def _create_estimation_prompt(
        self,
        bank_data: BankStatementData,
        foir_result: Optional[FOIRResult]
    ) -> str:
        """Create prompt for CIBIL estimation"""

        # Prepare context
        context = f"""Based on the following financial data, estimate the CIBIL score:

**Bank Account Metrics:**
- Average Monthly Balance: ₹{bank_data.average_monthly_balance:,.2f}
- Minimum Balance: ₹{bank_data.minimum_balance:,.2f}
- Average Monthly EMI: ₹{bank_data.average_monthly_emi:,.2f}
- Unique Loan Accounts: {bank_data.unique_loan_accounts}
- Bounce Count: {bank_data.bounce_count}
- Dishonor Count: {bank_data.dishonor_count}
- Insufficient Fund Incidents: {bank_data.insufficient_fund_incidents}
- Salary Consistency: {bank_data.salary_consistency_months} months

"""

        if foir_result:
            context += f"""**FOIR Analysis:**
- FOIR: {foir_result.foir_percentage}% ({foir_result.foir_status.value})
- Monthly Income: ₹{foir_result.monthly_net_income:,.2f}
- Monthly EMI: ₹{foir_result.total_monthly_emi:,.2f}
- Available Income: ₹{foir_result.available_monthly_income:,.2f}

"""

        context += """**Instructions:**
Estimate the CIBIL score (300-900) based on:
1. Payment behavior (bounces/dishonors indicate missed payments)
2. Credit utilization (EMI vs income ratio)
3. Account maintenance (balance consistency)
4. Credit history length (loan accounts)

Provide:
- Estimated score (realistic range)
- Risk level (excellent/good/fair/poor/very_poor)
- Confidence in estimate (0.0-1.0)
- Positive factors contributing to good score
- Negative factors reducing score
- Recommendations for improvement
- Estimation basis (explanation of how you arrived at the score)

The system will validate your response automatically."""

        return context

    def estimate_cibil(
        self,
        bank_data: Optional[BankStatementData],
        foir_result: Optional[FOIRResult]
    ) -> Optional[CIBILEstimate]:
        """
        Estimate CIBIL score with structured output.

        Args:
            bank_data: Bank statement analysis
            foir_result: FOIR calculation result

        Returns:
            CIBILEstimate with validated data
        """
        if not bank_data:
            logger.warning("  ⚠️ No bank data available for CIBIL estimation")
            return None

        logger.info("🎯 Estimating CIBIL score...")

        try:
            prompt = self._create_estimation_prompt(bank_data, foir_result)
            messages = self.create_gemini_content(prompt, [])

            # ✅ Invoke with structured output
            estimation = self.invoke_structured_with_retry(
                messages,
                schema=CIBILEstimate
            )

            logger.info(f"  ✅ Estimated Score: {estimation.estimated_score}")
            logger.info(f"  📊 Risk Level: {estimation.risk_level.value}")
            logger.info(f"  🎯 Confidence: {estimation.confidence:.0%}")

            return estimation

        except Exception as e:
            logger.error(f"  ❌ CIBIL estimation failed: {e}")
            return None
