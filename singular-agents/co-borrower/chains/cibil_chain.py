"""
CIBIL Estimation Chain - ANALYTICS ONLY, NO APPROVAL DECISIONS
"""

import logging
from typing import Optional

from schemas import CIBILEstimate, CIBILRiskLevel, BankStatementData, FOIRResult

logger = logging.getLogger(__name__)


class CIBILChain:
    """Estimate CIBIL score from indirect indicators - Pure analytics"""

    def estimate_cibil(
        self,
        bank_data: Optional[BankStatementData],
        foir_result: Optional[FOIRResult]
    ) -> CIBILEstimate:
        """Estimate CIBIL score from available data - NO DECISIONING"""

        logger.info("🎯 Estimating CIBIL score...")

        # Initialize scoring components
        payment_score = 0.5  # Neutral default
        credit_util_score = 0.5
        income_stability_score = 0.5
        credit_mix_score = 0.5

        positive_factors = []
        negative_factors = []
        risk_indicators = []

        # Analyze bank data if available
        if bank_data:
            # Payment discipline
            if bank_data.bounce_count == 0 and bank_data.dishonor_count == 0:
                payment_score = 0.9
                positive_factors.append(
                    "No payment bounces or dishonors detected")
            elif bank_data.bounce_count <= 2:
                payment_score = 0.6
                risk_indicators.append(
                    f"{bank_data.bounce_count} payment bounce(s)")
            else:
                payment_score = 0.3
                negative_factors.append(
                    f"Multiple payment bounces: {bank_data.bounce_count}")

            # Credit utilization (EMI burden)
            if bank_data.average_monthly_emi > 0 and bank_data.average_monthly_salary > 0:
                emi_ratio = bank_data.average_monthly_emi / bank_data.average_monthly_salary
                if emi_ratio < 0.3:
                    credit_util_score = 0.9
                    positive_factors.append("Low EMI burden (< 30% of income)")
                elif emi_ratio < 0.5:
                    credit_util_score = 0.7
                else:
                    credit_util_score = 0.4
                    risk_indicators.append(
                        f"High EMI burden: {emi_ratio*100:.1f}% of income")

            # Income stability
            if bank_data.salary_consistency_months >= 6:
                income_stability_score = 0.9
                positive_factors.append(
                    f"Consistent salary for {bank_data.salary_consistency_months} months")
            elif bank_data.salary_consistency_months >= 3:
                income_stability_score = 0.7
            else:
                income_stability_score = 0.5
                risk_indicators.append("Limited salary history")

            # Credit mix (loan diversity)
            if bank_data.unique_loan_accounts > 0:
                credit_mix_score = min(
                    0.5 + (bank_data.unique_loan_accounts * 0.15), 0.9)
                positive_factors.append(
                    f"{bank_data.unique_loan_accounts} active loan account(s)")

        # Analyze FOIR if available
        if foir_result:
            if foir_result.foir_status.value == "low":
                positive_factors.append("Low FOIR - good repayment capacity")
            elif foir_result.foir_status.value == "critical":
                negative_factors.append("Critical FOIR - high debt burden")
                risk_indicators.append(f"FOIR: {foir_result.foir_percentage}%")

        # Calculate composite score (weighted average)
        composite_score = (
            payment_score * 0.35 +           # 35% weight
            credit_util_score * 0.30 +       # 30% weight
            income_stability_score * 0.25 +  # 25% weight
            credit_mix_score * 0.10          # 10% weight
        )

        # Map to CIBIL score (300-900 range)
        # composite_score range: 0.0 to 1.0
        # CIBIL range: 300 to 900
        base_score = 300 + (composite_score * 600)
        estimated_score = int(round(base_score))

        # Determine band and risk level
        if estimated_score >= 750:
            band = "750-900"
            risk = CIBILRiskLevel.LOW
        elif estimated_score >= 700:
            band = "700-749"
            risk = CIBILRiskLevel.MEDIUM_LOW
        elif estimated_score >= 650:
            band = "650-699"
            risk = CIBILRiskLevel.MEDIUM
        elif estimated_score >= 600:
            band = "600-649"
            risk = CIBILRiskLevel.MEDIUM_HIGH
        else:
            band = f"{estimated_score//50*50}-{estimated_score//50*50+49}"
            risk = CIBILRiskLevel.HIGH

        # Construct result - PURE ANALYTICS ONLY (no approval likelihood or recommendations)
        result = CIBILEstimate(
            estimated_score=estimated_score,
            estimated_band=band,
            risk_level=risk,
            payment_history_score=round(payment_score, 2),
            credit_utilization_score=round(credit_util_score, 2),
            income_stability_score=round(income_stability_score, 2),
            credit_mix_score=round(credit_mix_score, 2),
            positive_factors=positive_factors,
            negative_factors=negative_factors,
            risk_indicators=risk_indicators
        )

        # Log results
        logger.info(f"   ✅ Estimated CIBIL Score: {result.estimated_score}")
        logger.info(f"      📊 Band: {result.estimated_band}")
        logger.info(f"      ⚠️  Risk: {result.risk_level.value}")

        return result
