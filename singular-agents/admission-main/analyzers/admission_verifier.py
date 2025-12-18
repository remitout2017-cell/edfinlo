from schemas import AdmissionLetter, VerificationResult
from config import Config
from typing import List
from datetime import datetime


class AdmissionLetterVerifier:
    """Verify admission letter entries"""

    @staticmethod
    def verify_single(admission: AdmissionLetter) -> VerificationResult:
        """Verify single admission letter entry"""
        print(f"🔍 Verifying: {admission.university_name or 'Unknown'}...")

        issues = []
        warnings = []
        confidence = "high"

        # CRITICAL: Check for mandatory admission/offer letter
        if not admission.has_admission_letter:
            issues.append(
                "❌ MISSING MANDATORY DOCUMENT: Admission/Offer letter required")
            confidence = "low"
            print(f"  ⚠️ WARNING: No admission/offer letter for this entry!")

        # Required field checks
        if not admission.university_name or len(admission.university_name.strip()) < 2:
            issues.append("University name missing or too short")
            confidence = "low"

        if not admission.program_name or len(admission.program_name.strip()) < 2:
            issues.append("Program name missing or too short")
            confidence = "low"

        # Degree level validation
        if admission.degree_level not in Config.DEGREE_LEVELS:
            warnings.append(f"Unknown degree level: {admission.degree_level}")

        # Intake year validation
        if admission.intake_year:
            if admission.intake_year < Config.MIN_INTAKE_YEAR:
                issues.append(
                    f"Intake year {admission.intake_year} is in the past")
                confidence = "low"
            elif admission.intake_year > Config.MAX_FUTURE_YEAR:
                issues.append(
                    f"Intake year {admission.intake_year} too far in future")
                confidence = "low"
        else:
            warnings.append("Intake year not provided")
            confidence = "medium" if confidence == "high" else confidence

        # Intake term validation
        if admission.intake_term:
            term_lower = admission.intake_term.lower()
            if not any(valid_term in term_lower for valid_term in Config.INTAKE_TERMS):
                warnings.append(
                    f"Unusual intake term: {admission.intake_term}")

        # Country validation
        if not admission.country:
            warnings.append("Country not specified")
            confidence = "medium" if confidence == "high" else confidence

        # Tuition fee validation
        if admission.tuition_fee:
            if admission.tuition_fee < Config.MIN_TUITION_FEE:
                warnings.append(
                    f"Tuition fee ${admission.tuition_fee} seems unusually low")
            elif admission.tuition_fee > Config.MAX_TUITION_FEE:
                warnings.append(
                    f"Tuition fee ${admission.tuition_fee} seems unusually high")

        # Deadline validation
        deadlines = [
            ("acceptance_deadline", admission.acceptance_deadline),
            ("enrollment_deadline", admission.enrollment_deadline),
            ("fee_payment_deadline", admission.fee_payment_deadline)
        ]

        for deadline_name, deadline_value in deadlines:
            if deadline_value:
                try:
                    day, month, year = map(int, deadline_value.split('/'))
                    deadline_date = datetime(year, month, day)

                    # Check if deadline is in the past
                    if deadline_date < datetime.now():
                        warnings.append(
                            f"{deadline_name.replace('_', ' ').title()} has passed")
                except:
                    warnings.append(
                        f"Invalid {deadline_name.replace('_', ' ')} format: {deadline_value}")

        # Conditional admission checks
        if admission.conditional_admission:
            if not admission.conditions or len(admission.conditions) == 0:
                warnings.append(
                    "Marked as conditional but no conditions listed")

        # Extraction confidence factor
        if admission.extraction_confidence < 0.7:
            if confidence == "high":
                confidence = "medium"
            warnings.append("Document quality/extraction confidence is low")

        # Scholarship validation
        if admission.scholarship_mentioned and admission.scholarship_amount:
            if admission.scholarship_amount > admission.tuition_fee if admission.tuition_fee else False:
                warnings.append("Scholarship amount exceeds tuition fee")

        # Determine validity - MUST have admission/offer letter to be valid
        valid = len(issues) == 0 and admission.has_admission_letter

        # Build reason
        if not admission.has_admission_letter:
            reason = "❌ Missing mandatory admission/offer letter"
        elif valid:
            reason = "All required fields present and valid with admission letter"
        else:
            reason = f"Found {len(issues)} validation issue(s)"

        # Check mandatory documents
        has_mandatory = admission.has_admission_letter

        print(f"  {'✅' if valid else '❌'} Valid: {valid} (Confidence: {confidence})")
        print(
            f"  {'✅' if has_mandatory else '❌'} Has Admission Letter: {has_mandatory}")

        if issues:
            for issue in issues:
                print(f"    Issue: {issue}")

        if warnings:
            for warning in warnings[:3]:  # Show max 3 warnings
                print(f"    Warning: {warning}")

        return VerificationResult(
            valid=valid,
            confidence=confidence,
            reason=reason,
            issues=issues,
            warnings=warnings,
            has_mandatory_documents=has_mandatory
        )

    @staticmethod
    def verify_multiple(admissions: List[AdmissionLetter]) -> List[VerificationResult]:
        """Verify multiple admission letters"""
        print(f"\n🔍 Verifying {len(admissions)} admission letters...")

        results = []
        for i, admission in enumerate(admissions):
            print(f"  Entry {i+1}/{len(admissions)}:")
            result = AdmissionLetterVerifier.verify_single(admission)
            results.append(result)

        valid_count = sum(1 for r in results if r.valid)
        with_admission_letter = sum(
            1 for r in results if r.has_mandatory_documents)

        print(f"\n✅ Verification complete:")
        print(f"   - Valid entries: {valid_count}/{len(results)}")
        print(
            f"   - With admission letter: {with_admission_letter}/{len(results)}")

        return results
