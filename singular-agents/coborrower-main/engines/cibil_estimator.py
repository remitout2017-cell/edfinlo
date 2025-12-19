"""
ADVANCED CIBIL Score Estimation Engine
Based on actual CIBIL scoring factors with weighted model
"""

from schemas import CIBILEstimate
from config import Config


class CIBILEstimator:
    """
    Rule-based CIBIL estimation with industry-standard weights
    
    CIBIL Score Factors (actual weights):
    - Payment History: 35%
    - Credit Utilization: 30%
    - Credit History Length: 15%
    - Credit Mix: 10%
    - New Credit: 10%
    
    We approximate these using available data
    """
    
    # Scoring weights (adjusted for available data)
    WEIGHT_PAYMENT_DISCIPLINE = 0.40  # Bounce count, EMI regularity
    WEIGHT_FOIR = 0.30  # Credit utilization proxy
    WEIGHT_INCOME_STABILITY = 0.20  # Salary consistency
    WEIGHT_CREDIT_MIX = 0.10  # Diverse EMI sources
    
    @staticmethod
    def estimate(
        foir: float,
        bounce_count: int,
        salary_consistency: int,
        emi_count: int = 0,
        monthly_income: float = 0.0,
        monthly_emi: float = 0.0
    ) -> CIBILEstimate:
        """
        Estimate CIBIL band using multi-factor scoring
        
        Args:
            foir: FOIR percentage (0-100)
            bounce_count: Number of bounced payments
            salary_consistency: Number of months with regular salary
            emi_count: Number of active EMI accounts
            monthly_income: Monthly income (for additional validation)
            monthly_emi: Total monthly EMI (for additional validation)
        """
        
        # Start with baseline score (India median ~715)
        base_score = 715
        
        # ========== FACTOR 1: PAYMENT DISCIPLINE (40%) ==========
        payment_score = CIBILEstimator._calculate_payment_score(bounce_count)
        
        # ========== FACTOR 2: FOIR / CREDIT UTILIZATION (30%) ==========
        foir_score = CIBILEstimator._calculate_foir_score(foir)
        
        # ========== FACTOR 3: INCOME STABILITY (20%) ==========
        stability_score = CIBILEstimator._calculate_stability_score(salary_consistency)
        
        # ========== FACTOR 4: CREDIT MIX (10%) ==========
        credit_mix_score = CIBILEstimator._calculate_credit_mix_score(emi_count)
        
        # ========== CALCULATE FINAL SCORE ==========
        weighted_adjustment = (
            payment_score * CIBILEstimator.WEIGHT_PAYMENT_DISCIPLINE +
            foir_score * CIBILEstimator.WEIGHT_FOIR +
            stability_score * CIBILEstimator.WEIGHT_INCOME_STABILITY +
            credit_mix_score * CIBILEstimator.WEIGHT_CREDIT_MIX
        )
        
        final_score = int(base_score + weighted_adjustment)
        
        # Cap within valid range
        final_score = max(300, min(900, final_score))
        
        # ========== DETERMINE BAND AND RISK ==========
        band_name, band_range = CIBILEstimator._get_band(final_score)
        risk_level = CIBILEstimator._get_risk_level(final_score)
        
        # ========== ADDITIONAL INSIGHTS ==========
        insights = CIBILEstimator._generate_insights(
            foir, bounce_count, salary_consistency, final_score
        )
        
        return CIBILEstimate(
            estimated_band=band_range,
            estimated_score=final_score,
            risk_level=risk_level,
            insights=insights if hasattr(CIBILEstimate, 'insights') else None
        )
    
    @staticmethod
    def _calculate_payment_score(bounce_count: int) -> float:
        """
        Payment discipline score (-150 to +50)
        Bounces are CRITICAL negative factors
        """
        if bounce_count == 0:
            return 50  # Perfect payment history
        elif bounce_count == 1:
            return -30  # Single bounce - moderate damage
        elif bounce_count == 2:
            return -70  # Two bounces - significant damage
        elif bounce_count == 3:
            return -110  # Three bounces - severe damage
        else:
            return -150  # 4+ bounces - critical damage
    
    @staticmethod
    def _calculate_foir_score(foir: float) -> float:
        """
        FOIR/Utilization score (-80 to +40)
        Lower FOIR = better credit management
        """
        if foir <= 30:
            return 40  # Excellent - minimal debt burden
        elif foir <= 40:
            return 25  # Very good
        elif foir <= 50:
            return 10  # Good
        elif foir <= 60:
            return -10  # Fair - moderate concern
        elif foir <= 70:
            return -35  # Poor - high burden
        elif foir <= 80:
            return -60  # Very poor
        else:
            return -80  # Critical - unsustainable debt
    
    @staticmethod
    def _calculate_stability_score(salary_consistency: int) -> float:
        """
        Income stability score (-30 to +30)
        Regular salary = creditworthy
        """
        if salary_consistency >= 6:
            return 30  # 6+ months - excellent stability
        elif salary_consistency >= 4:
            return 20  # 4-5 months - good stability
        elif salary_consistency >= 3:
            return 10  # 3 months - acceptable
        elif salary_consistency >= 2:
            return -10  # 2 months - concerning
        else:
            return -30  # <2 months - high risk
    
    @staticmethod
    def _calculate_credit_mix_score(emi_count: int) -> float:
        """
        Credit mix score (0 to +20)
        Multiple credit types = responsible borrower
        """
        if emi_count >= 3:
            return 20  # 3+ types - diverse credit mix
        elif emi_count == 2:
            return 15  # 2 types - good
        elif emi_count == 1:
            return 5  # Single type - limited history
        else:
            return 0  # No credit - neutral (not negative)
    
    @staticmethod
    def _get_band(score: int) -> tuple:
        """Get CIBIL band name and range"""
        for name, (min_score, max_score) in Config.CIBIL_BANDS.items():
            if min_score <= score <= max_score:
                return name.title(), f"{min_score}-{max_score}"
        
        return "Unknown", "NA"
    
    @staticmethod
    def _get_risk_level(score: int) -> str:
        """Determine lending risk level"""
        if score >= 750:
            return "low"  # Prime borrowers
        elif score >= 700:
            return "medium_low"  # Near-prime
        elif score >= 650:
            return "medium"  # Subprime
        elif score >= 600:
            return "medium_high"  # High subprime
        else:
            return "high"  # Very high risk
    
    @staticmethod
    def _generate_insights(
        foir: float,
        bounce_count: int,
        salary_consistency: int,
        final_score: int
    ) -> dict:
        """
        Generate actionable insights
        """
        insights = {
            "score_range": f"{final_score-25} to {final_score+25}",
            "primary_factors": [],
            "red_flags": [],
            "approval_likelihood": ""
        }
        
        # Identify primary factors
        if bounce_count > 0:
            insights["red_flags"].append(f"{bounce_count} payment bounce(s) detected")
        
        if foir > 60:
            insights["red_flags"].append(f"High FOIR at {foir:.1f}%")
        
        if salary_consistency < 3:
            insights["red_flags"].append("Insufficient salary consistency")
        
        # Positive factors
        if bounce_count == 0:
            insights["primary_factors"].append("Clean payment history")
        
        if foir < 50:
            insights["primary_factors"].append("Healthy debt-to-income ratio")
        
        if salary_consistency >= 4:
            insights["primary_factors"].append("Stable income history")
        
        # Approval likelihood
        if final_score >= 750:
            insights["approval_likelihood"] = "High (90%+)"
        elif final_score >= 700:
            insights["approval_likelihood"] = "Good (70-80%)"
        elif final_score >= 650:
            insights["approval_likelihood"] = "Moderate (50-60%)"
        else:
            insights["approval_likelihood"] = "Low (<40%)"
        
        return insights