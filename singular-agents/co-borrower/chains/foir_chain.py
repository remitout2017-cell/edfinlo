"""
FOIR Chain - Precise FOIR calculation with income cross-validation
"""
import logging
from typing import Optional
from schemas import FOIRResult, FOIRStatus, ITRData, BankStatementData, SalarySlipData

logger = logging.getLogger(__name__)


class FOIRChain:
    """Calculate FOIR (Fixed Obligation to Income Ratio) with cross-validation"""

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
        """
        Calculate FOIR from available data sources with income cross-validation.

        Returns:
            FOIRResult with precise FOIR percentage and risk status
        """
        logger.info("🧮 Calculating FOIR with income cross-validation...")

        # Determine monthly income with cross-validation
        monthly_gross, monthly_net = self._determine_monthly_income(
            itr_data, bank_data, salary_data
        )

        # Get EMI obligations from bank statement
        total_emi = 0.0
        if bank_data and bank_data.average_monthly_emi > 0:
            total_emi = bank_data.average_monthly_emi
            logger.info(f"   💳 Monthly EMI: ₹{total_emi:,.2f}")

        # Calculate FOIR metrics
        if monthly_net > 0:
            foir_percentage = (total_emi / monthly_net) * 100
            emi_to_income = total_emi / monthly_net
            dscr = monthly_net / total_emi if total_emi > 0 else 999.9
        else:
            foir_percentage = 100.0 if total_emi > 0 else 0.0
            emi_to_income = 0.0
            dscr = 0.0

        # Determine FOIR status (risk band)
        if foir_percentage < self.FOIR_THRESHOLD_LOW:
            status = FOIRStatus.LOW
        elif foir_percentage < self.FOIR_THRESHOLD_MEDIUM:
            status = FOIRStatus.MEDIUM
        elif foir_percentage < self.FOIR_THRESHOLD_HIGH:
            status = FOIRStatus.HIGH
        else:
            status = FOIRStatus.CRITICAL

        available_income = monthly_net - total_emi

        # Construct result
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
            f"      Monthly Gross Income: ₹{result.monthly_gross_income:,.2f}")
        logger.info(
            f"      Monthly Net Income: ₹{result.monthly_net_income:,.2f}")
        logger.info(
            f"      Available Income: ₹{result.available_monthly_income:,.2f}")
        logger.info(f"      DSCR: {result.debt_service_coverage_ratio:.2f}")

        return result

    def _determine_monthly_income(
        self,
        itr_data: Optional[ITRData],
        bank_data: Optional[BankStatementData],
        salary_data: Optional[SalarySlipData]
    ) -> tuple[float, float]:
        """
        Determine monthly income with cross-validation for precision.

        Returns:
            (monthly_gross, monthly_net) tuple
        """
        candidates = {}

        # Collect all available income sources
        if salary_data and salary_data.average_net_salary > 0:
            candidates["salary_slip"] = {
                "gross": salary_data.average_gross_salary,
                "net": salary_data.average_net_salary
            }

        if bank_data and bank_data.average_monthly_salary > 0:
            candidates["bank_salary"] = {
                "gross": bank_data.average_monthly_salary,
                "net": bank_data.average_monthly_salary * 0.85  # Assume 15% deductions
            }

        if itr_data and itr_data.average_monthly_income > 0:
            candidates["itr"] = {
                "gross": itr_data.average_monthly_income,
                "net": itr_data.average_monthly_income * 0.80  # Assume 20% deductions
            }

        if not candidates:
            logger.warning(" ⚠️ No valid income source found")
            return 0.0, 0.0

        # Priority: Salary slip > Bank salary > ITR
        # But cross-validate salary slip vs bank if both exist
        if "salary_slip" in candidates:
            slip_net = candidates["salary_slip"]["net"]
            slip_gross = candidates["salary_slip"]["gross"]

            # Cross-validate with bank if available
            if "bank_salary" in candidates:
                bank_net = candidates["bank_salary"]["net"]

                if slip_net > 0:
                    mismatch = abs(slip_net - bank_net) / slip_net

                    if mismatch > 0.15:  # More than 15% difference
                        logger.warning(
                            f" ⚠️ Income mismatch detected: "
                            f"Salary slip ₹{slip_net:,.2f} vs Bank ₹{bank_net:,.2f} "
                            f"(diff: {mismatch:.1%})"
                        )
                        logger.warning(
                            f"    Using conservative (lower) value for FOIR safety")

                        # Use lower value for risk-conservative FOIR
                        if slip_net < bank_net:
                            logger.info(
                                f"   📊 Using Salary Slip income: ₹{slip_net:,.2f}")
                            return slip_gross, slip_net
                        else:
                            logger.info(
                                f"   📊 Using Bank Statement income: ₹{bank_net:,.2f}")
                            return candidates["bank_salary"]["gross"], bank_net

            logger.info(f"   📊 Using Salary Slip income: ₹{slip_net:,.2f}")
            return slip_gross, slip_net

        # Otherwise use bank salary, else ITR
        if "bank_salary" in candidates:
            logger.info(
                f"   📊 Using Bank Statement income: ₹{candidates['bank_salary']['net']:,.2f}")
            return candidates["bank_salary"]["gross"], candidates["bank_salary"]["net"]

        logger.info(f"   📊 Using ITR income: ₹{candidates['itr']['net']:,.2f}")
        return candidates["itr"]["gross"], candidates["itr"]["net"]
