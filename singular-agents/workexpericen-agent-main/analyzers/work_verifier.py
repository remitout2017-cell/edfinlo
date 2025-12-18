from schemas import WorkExperience, VerificationResult
from config import Config
from typing import List
from datetime import datetime


class WorkExperienceVerifier:
    """Verify work experience entries"""

    @staticmethod
    def verify_single(work_exp: WorkExperience) -> VerificationResult:
        """Verify single work experience entry"""
        print(f"🔍 Verifying: {work_exp.company_name}...")

        issues = []
        warnings = []
        confidence = "high"

        # CRITICAL: Check for mandatory experience letter
        if not work_exp.has_experience_letter:
            issues.append(
                "❌ MISSING MANDATORY DOCUMENT: Experience letter required")
            confidence = "low"
            print(f"   ⚠️ WARNING: No experience letter for this entry!")

        # Required field checks
        if not work_exp.company_name or len(work_exp.company_name.strip()) < 2:
            issues.append("Company name missing or too short")
            confidence = "low"

        if not work_exp.job_title or len(work_exp.job_title.strip()) < 2:
            issues.append("Job title missing or too short")
            confidence = "low"

        # Date validation
        if work_exp.start_date:
            try:
                day, month, year = map(int, work_exp.start_date.split('/'))
                if year < Config.MIN_START_YEAR or year > Config.MAX_FUTURE_YEAR:
                    issues.append(f"Start year {year} out of valid range")
                    confidence = "medium" if confidence == "high" else "low"
            except:
                issues.append(
                    "Invalid start date format (should be DD/MM/YYYY)")
                confidence = "low"
        else:
            warnings.append("Start date not provided")
            confidence = "medium" if confidence == "high" else confidence

        # End date chronology check
        if work_exp.end_date and work_exp.start_date:
            try:
                start_day, start_month, start_year = map(
                    int, work_exp.start_date.split('/'))
                end_day, end_month, end_year = map(
                    int, work_exp.end_date.split('/'))

                start_dt = datetime(start_year, start_month, start_day)
                end_dt = datetime(end_year, end_month, end_day)

                if end_dt < start_dt:
                    issues.append("End date is before start date")
                    confidence = "low"

                # Calculate duration
                duration_days = (end_dt - start_dt).days
                if duration_days < 1:
                    warnings.append("Work duration is less than 1 day")
                elif duration_days < 30:
                    warnings.append("Work duration is less than 1 month")

            except:
                warnings.append("Could not validate date chronology")

        # Currently working validation
        if work_exp.currently_working and work_exp.end_date:
            try:
                end_day, end_month, end_year = map(
                    int, work_exp.end_date.split('/'))
                end_dt = datetime(end_year, end_month, end_day)
                if end_dt < datetime.now():
                    warnings.append(
                        "Marked as currently working but has past end date")
            except:
                pass

        # Salary validation (if provided)
        if work_exp.stipend_amount:
            if work_exp.stipend_amount < Config.MIN_SALARY:
                warnings.append(
                    f"Salary (₹{work_exp.stipend_amount}) seems unusually low")
            elif work_exp.stipend_amount > Config.MAX_SALARY:
                warnings.append(
                    f"Salary (₹{work_exp.stipend_amount}) seems unusually high")

        # Extraction confidence factor
        if work_exp.extraction_confidence < 0.7:
            if confidence == "high":
                confidence = "medium"
            warnings.append("Document quality/extraction confidence is low")

        # Internship-specific checks
        if "internship" in work_exp.employment_type:
            if work_exp.stipend_amount and work_exp.stipend_amount > 50000:
                warnings.append(
                    "Internship stipend seems high for an internship")

            if not work_exp.is_paid and work_exp.employment_type == "internship_paid":
                issues.append("Marked as paid internship but is_paid is False")

        # Source document validation
        if work_exp.source_document_type not in ["experience_letter", "offer_letter", "relieving_letter", "salary_slip", "appointment_letter", "other"]:
            warnings.append(
                f"Unknown source document type: {work_exp.source_document_type}")

        # Determine validity - MUST have experience letter to be valid
        valid = len(issues) == 0 and work_exp.has_experience_letter

        # Build reason
        if not work_exp.has_experience_letter:
            reason = "❌ Missing mandatory experience letter"
        elif valid:
            reason = "All required fields present and valid with experience letter"
        else:
            reason = f"Found {len(issues)} validation issue(s)"

        # Check mandatory documents
        has_mandatory = work_exp.has_experience_letter

        print(
            f"   {'✅' if valid else '❌'} Valid: {valid} (Confidence: {confidence})")
        print(
            f"   {'✅' if has_mandatory else '❌'} Has Experience Letter: {has_mandatory}")

        if issues:
            for issue in issues:
                print(f"      Issue: {issue}")
        if warnings:
            for warning in warnings[:3]:  # Show max 3 warnings
                print(f"      Warning: {warning}")

        return VerificationResult(
            valid=valid,
            confidence=confidence,
            reason=reason,
            issues=issues,
            warnings=warnings,
            has_mandatory_documents=has_mandatory
        )

    @staticmethod
    def verify_multiple(work_experiences: List[WorkExperience]) -> List[VerificationResult]:
        """Verify multiple work experiences"""
        print(f"\n🔍 Verifying {len(work_experiences)} work experiences...")

        results = []
        for i, work_exp in enumerate(work_experiences):
            print(f"   Entry {i+1}/{len(work_experiences)}:")
            result = WorkExperienceVerifier.verify_single(work_exp)
            results.append(result)

        valid_count = sum(1 for r in results if r.valid)
        with_exp_letter = sum(1 for r in results if r.has_mandatory_documents)

        print(f"\n✅ Verification complete:")
        print(f"   - Valid entries: {valid_count}/{len(results)}")
        print(f"   - With experience letter: {with_exp_letter}/{len(results)}")

        return results
