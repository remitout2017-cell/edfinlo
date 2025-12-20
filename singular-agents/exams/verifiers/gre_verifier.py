from schemas import GREScore, VerificationResult
from config import Config
from datetime import datetime, timedelta

class GREVerifier:
    """Verify GRE score validity"""
    
    def verify(self, score: GREScore) -> VerificationResult:
        """Verify GRE score data"""
        issues = []
        warnings = []
        confidence = 1.0
        
        # Check Verbal Reasoning
        if score.verbal_reasoning is None:
            issues.append("Verbal Reasoning score is missing")
            confidence -= 0.25
        elif not (130 <= score.verbal_reasoning <= 170):
            issues.append(f"Verbal Reasoning {score.verbal_reasoning} out of range (130-170)")
            confidence -= 0.3
        
        # Check Quantitative Reasoning
        if score.quantitative_reasoning is None:
            issues.append("Quantitative Reasoning score is missing")
            confidence -= 0.25
        elif not (130 <= score.quantitative_reasoning <= 170):
            issues.append(f"Quantitative Reasoning {score.quantitative_reasoning} out of range (130-170)")
            confidence -= 0.3
        
        # Check Analytical Writing
        if score.analytical_writing is None:
            issues.append("Analytical Writing score is missing")
            confidence -= 0.2
        elif not (0.0 <= score.analytical_writing <= 6.0):
            issues.append(f"Analytical Writing {score.analytical_writing} out of range (0.0-6.0)")
            confidence -= 0.25
        else:
            # Check if score is in 0.5 increments
            if (score.analytical_writing * 2) % 1 != 0:
                warnings.append(f"Analytical Writing {score.analytical_writing} should be in 0.5 increments")
                confidence -= 0.05
        
        # Check test date
        if score.test_date is None:
            warnings.append("Test date is missing")
            confidence -= 0.1
        else:
            # Check if expired (5 years validity)
            expiry_date = score.test_date + timedelta(days=365 * Config.GRE_VALIDITY_YEARS)
            if datetime.now().date() > expiry_date:
                warnings.append(f"Score expired on {expiry_date.isoformat()}")
        
        # Check registration number
        if not score.registration_number:
            warnings.append("Registration number is missing")
            confidence -= 0.05
        
        valid = len(issues) == 0 and confidence >= 0.6
        
        return VerificationResult(
            valid=valid,
            confidence_score=max(0.0, confidence),
            issues=issues,
            warnings=warnings,
            score_validity_check=score.test_date is not None,
            date_validity_check=score.test_date is not None
        )
