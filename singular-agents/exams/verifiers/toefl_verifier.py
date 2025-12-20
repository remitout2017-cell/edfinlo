from schemas import TOEFLScore, VerificationResult
from config import Config
from datetime import datetime, timedelta

class TOEFLVerifier:
    """Verify TOEFL score validity"""
    
    def verify(self, score: TOEFLScore) -> VerificationResult:
        """Verify TOEFL score data"""
        issues = []
        warnings = []
        confidence = 1.0
        
        # Check section scores
        sections = [score.reading, score.listening, score.speaking, score.writing]
        for idx, (section_score, name) in enumerate(zip(sections, ["Reading", "Listening", "Speaking", "Writing"])):
            if section_score is None:
                issues.append(f"{name} score is missing")
                confidence -= 0.15
            elif not (0 <= section_score <= 30):
                issues.append(f"{name} score {section_score} is out of range (0-30)")
                confidence -= 0.2
        
        # Check total score
        if score.total_score is None:
            issues.append("Total score is missing")
            confidence -= 0.2
        elif not (0 <= score.total_score <= 120):
            issues.append(f"Total score {score.total_score} is out of range (0-120)")
            confidence -= 0.25
        else:
            # Verify total = sum of sections
            if all(s is not None for s in sections):
                expected_total = sum(sections)
                if score.total_score != expected_total:
                    warnings.append(f"Total score {score.total_score} doesn't match sum of sections {expected_total}")
                    confidence -= 0.1
        
        # Check test date
        if score.test_date is None:
            warnings.append("Test date is missing")
            confidence -= 0.1
        else:
            # Check if expired (2 years validity)
            expiry_date = score.test_date + timedelta(days=365 * Config.TOEFL_VALIDITY_YEARS)
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
