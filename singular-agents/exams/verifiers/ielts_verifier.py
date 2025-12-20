from schemas import IELTSScore, VerificationResult
from config import Config
from datetime import datetime, timedelta

class IELTSVerifier:
    """Verify IELTS score validity"""
    
    def verify(self, score: IELTSScore) -> VerificationResult:
        """Verify IELTS score data"""
        issues = []
        warnings = []
        confidence = 1.0
        
        # Check section scores
        sections = [
            (score.listening, "Listening"),
            (score.reading, "Reading"),
            (score.writing, "Writing"),
            (score.speaking, "Speaking")
        ]
        
        valid_sections = []
        for section_score, name in sections:
            if section_score is None:
                issues.append(f"{name} band score is missing")
                confidence -= 0.15
            elif not (0.0 <= section_score <= 9.0):
                issues.append(f"{name} band {section_score} out of range (0.0-9.0)")
                confidence -= 0.2
            elif (section_score * 2) % 1 != 0:  # Check 0.5 increments
                warnings.append(f"{name} band {section_score} should be in 0.5 increments")
                confidence -= 0.05
            else:
                valid_sections.append(section_score)
        
        # Check overall band score
        if score.overall_band_score is None:
            issues.append("Overall band score is missing")
            confidence -= 0.2
        elif not (0.0 <= score.overall_band_score <= 9.0):
            issues.append(f"Overall band {score.overall_band_score} out of range (0.0-9.0)")
            confidence -= 0.25
        elif (score.overall_band_score * 2) % 1 != 0:
            warnings.append(f"Overall band {score.overall_band_score} should be in 0.5 increments")
            confidence -= 0.05
        else:
            # Verify overall = average of 4 sections (rounded to nearest 0.5)
            if len(valid_sections) == 4:
                avg = sum(valid_sections) / 4
                # Round to nearest 0.5
                expected_overall = round(avg * 2) / 2
                
                if abs(score.overall_band_score - expected_overall) > 0.01:
                    warnings.append(
                        f"Overall band {score.overall_band_score} doesn't match "
                        f"calculated average {expected_overall}"
                    )
                    confidence -= 0.1
        
        # Check test date
        if score.test_date is None:
            warnings.append("Test date is missing")
            confidence -= 0.1
        else:
            # Check if expired (2 years validity)
            expiry_date = score.test_date + timedelta(days=365 * Config.IELTS_VALIDITY_YEARS)
            if datetime.now().date() > expiry_date:
                warnings.append(f"Score expired on {expiry_date.isoformat()}")
        
        # Check candidate number
        if not score.candidate_number:
            warnings.append("Candidate number is missing")
            confidence -= 0.05
        
        # Check TRF number
        if not score.test_report_form_number:
            warnings.append("Test Report Form (TRF) number is missing")
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
