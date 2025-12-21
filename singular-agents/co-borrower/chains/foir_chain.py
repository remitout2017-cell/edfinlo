"""
FOIR Chain - ANALYTICS ONLY, NO LOAN ELIGIBILITY DECISIONS
"""

import logging
from typing import Optional

from schemas import FOIRResult, FOIRStatus, ITRData, BankStatementData, SalarySlipData

logger = logging.getLogger(__name__)


class FOIRChain:
    """Calculate FOIR (Fixed Obligation to Income Ratio) - Pure analytics"""

    FOIR_THRESHOLD_LOW = 40.0      # < 40% = Low risk
    FOIR_THRESHOLD_MEDIUM = 55.0   # 40-55% = Medium risk
    FOIR_THRESHOLD_HIGH = 65.0     # 55-65% = High risk
    # > 65% = Critical risk

    def calculate_foir(
        self,
        itr_data: Optional[ITRData],
        bank_data: Optional[BankStatementData],
        salary_data: Optional[SalarySlipData]
    ) -> FOIRResult:
        """Calculate FOIR from available data sources - NO DECISIONING"""

        logger.info("🧮 Calculating FOIR...")

        # Determine monthly income from priority: Salary > Bank > ITR
        monthly_gross = 0.0
        monthly_net = 0.0

        if salary_data and salary_data.average_net_salary > 0:
            monthly_gross = salary_data.average_gross_salary
            monthly_net = salary_data.average_net_salary
            logger.info(f"   📊 Using Salary Slip data")
        elif bank_data and bank_data.average_monthly_salary > 0:
            monthly_gross = bank_data.average_monthly_salary
            monthly_net = bank_data.average_monthly_salary * 0.85  # Assume 15% deductions
            logger.info(f"   📊 Using Bank Statement data")
        elif itr_data and itr_data.average_monthly_income > 0:
            monthly_gross = itr_data.average_monthly_income
            monthly_net = itr_data.average_monthly_income * 0.80  # Assume 20% deductions
            logger.info(f"   📊 Using ITR data")
        else:
            logger.warning("   ⚠️  No valid income source found")

        # Get EMI obligations
        total_emi = 0.0
        if bank_data and bank_data.average_monthly_emi > 0:
            total_emi = bank_data.average_monthly_emi

        # Calculate FOIR metrics
        if monthly_net > 0:
            foir_percentage = (total_emi / monthly_net) * 100
            emi_to_income = total_emi / monthly_net
            dscr = monthly_net / total_emi if total_emi > 0 else 999.9
        else:
            foir_percentage = 100.0 if total_emi > 0 else 0.0
            emi_to_income = 0.0
            dscr = 0.0

        # Determine FOIR status (risk band only, NO eligibility decision)
        if foir_percentage < self.FOIR_THRESHOLD_LOW:
            status = FOIRStatus.LOW
        elif foir_percentage < self.FOIR_THRESHOLD_MEDIUM:
            status = FOIRStatus.MEDIUM
        elif foir_percentage < self.FOIR_THRESHOLD_HIGH:
            status = FOIRStatus.HIGH
        else:
            status = FOIRStatus.CRITICAL

        available_income = monthly_net - total_emi

        # Construct result - PURE ANALYTICS ONLY
        result = FOIRResult(
            foir_percentage=round(foir_percentage, 2),
            foir_status=status,
            monthly_gross_income=round(monthly_gross, 2),
            monthly_net_income=round(monthly_net, 2),
            total_monthly_emi=round(total_emi, 2),
            available_monthly_income=round(available_income, 2),
            emi_to_income_ratio=round(emi_to_income, 4),
            debt_service_coverage_ratio=round(dscr, 2)
        )

        # Log results
        logger.info(
            f"   ✅ FOIR: {result.foir_percentage}% ({result.foir_status.value})")
        logger.info(
            f"      💵 Monthly Income: ₹{result.monthly_net_income:,.2f}")
        logger.info(f"      💳 Monthly EMI: ₹{result.total_monthly_emi:,.2f}")

        return result
