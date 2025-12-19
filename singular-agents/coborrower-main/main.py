"""
Main FOIR + CIBIL Calculation Engine
Updated for 4-document architecture with Form 16 support
"""

import time
import uuid
from pathlib import Path
from typing import Dict, List
from schemas import FinancialResult, FOIRResult, ExtractionMetadata
from extractors.salary_extractor import SalaryExtractor
from extractors.bank_extractor import BankExtractor
from extractors.itr_extractor import ITRExtractor
from extractors.form16_extractor import Form16Extractor
from engines.foir_engine import FOIREngine
from engines.cibil_estimator import CIBILEstimator
from utils import save_json


def calculate_foir_cibil(
    salary_slips: List[str],
    bank_statement: str,
    itr_docs: List[str]
) -> FinancialResult:
    """
    Enhanced FOIR + CIBIL calculation with 4-document architecture

    NOTE: Each PDF can be multi-page containing multiple documents:
    - salary_slips[0]: PDF with 3 months of salary slips
    - itr_docs[0]: PDF with 2 years of ITR
    - itr_docs[1]: PDF with 2 years of Form 16 (optional)
    - bank_statement: PDF with 6 months of statements

    Args:
        salary_slips: List with 1 PDF (containing 3 months salary slips)
        bank_statement: 1 PDF (containing 6 months statement)
        itr_docs: List with 1-2 PDFs (ITR + optional Form 16)

    Returns:
        FinancialResult with FOIR, CIBIL, and quality metadata
    """

    start_time = time.time()
    session_id = str(uuid.uuid4())[:8]
    errors = []
    warnings = []
    data_sources = []

    print(f"\n{'='*70}")
    print(f"💰 FOIR + CIBIL CALCULATION: {session_id}")
    print(f"   Architecture: 4-Document System")
    print(f"{'='*70}\n")

    try:
        # ========== STEP 1: EXTRACT SALARY DATA ==========
        print("📄 STEP 1: Extracting salary data from combined PDF...")
        print("   Expected: 3 months of salary slips in single PDF")

        salary_data = SalaryExtractor.extract(salary_slips)
        monthly_income = salary_data.get("avg_monthly_net", 0.0)
        salary_confidence = salary_data.get("confidence", 0.0)

        if monthly_income > 0:
            data_sources.append("salary_slips")
            print(
                f"   ✅ Monthly Income: ₹{monthly_income:,.2f} (Confidence: {salary_confidence:.0%})")
            print(f"   ✅ Slips processed: {salary_data.get('count', 0)}")
        else:
            warnings.append("Could not extract salary from slips")
            print(f"   ⚠️  Salary extraction failed")

        # ========== STEP 2: EXTRACT BANK STATEMENT ==========
        print("\n🏦 STEP 2: Extracting bank statement from combined PDF...")
        print("   Expected: 6 months of transactions in single PDF")

        bank_data = BankExtractor.extract(bank_statement)
        monthly_emi = bank_data.get("avg_monthly_emi", 0.0)
        bounce_count = bank_data.get("bounce_count", 0)
        salary_months = bank_data.get("salary_months", 0)
        bank_confidence = bank_data.get("confidence", 0.0)

        if monthly_emi > 0 or salary_months > 0:
            data_sources.append("bank_statement")
            print(f"   ✅ Monthly EMI: ₹{monthly_emi:,.2f}")
            print(f"   ✅ Bounces: {bounce_count}")
            print(f"   ✅ Salary Credits: {salary_months} months")
            print(f"   📊 Bank Confidence: {bank_confidence:.0%}")
        else:
            warnings.append("Incomplete bank statement extraction")
            print(f"   ⚠️  Bank extraction incomplete")

        # Cross-validate salary from bank statement
        bank_salary = bank_data.get("avg_monthly_salary", 0.0)
        if bank_salary > 0 and monthly_income > 0:
            variance = abs(bank_salary - monthly_income) / monthly_income
            if variance > 0.20:  # >20% difference
                warnings.append(
                    f"Salary mismatch: Slip(₹{monthly_income:,.0f}) vs Bank(₹{bank_salary:,.0f})")
                print(f"   ⚠️  Salary variance detected: {variance:.1%}")
            else:
                print(f"   ✅ Salary cross-validation passed")

        # Use bank salary as fallback if slip extraction failed
        if monthly_income == 0 and bank_salary > 10000:
            monthly_income = bank_salary
            print(f"   🔄 Using bank statement salary: ₹{monthly_income:,.2f}")

        # ========== STEP 3: EXTRACT ITR + FORM 16 DATA ==========
        print("\n📊 STEP 3: Extracting tax documents...")

        # Separate ITR and Form 16 documents
        itr_only = []
        form16_only = []

        for doc_path in itr_docs:
            # Simple heuristic: Form 16 typically has "form" or "16" in filename
            filename = Path(doc_path).name.lower()
            if 'form' in filename or 'form16' in filename:
                form16_only.append(doc_path)
            else:
                itr_only.append(doc_path)

        # If all docs in itr_docs, treat first as ITR
        if not itr_only and len(itr_docs) > 0:
            itr_only = [itr_docs[0]]
            if len(itr_docs) > 1:
                form16_only = itr_docs[1:]

        # Extract ITR data
        print("   📑 Processing ITR documents...")
        print(f"   Expected: 2 years of ITR in single/multiple PDFs")

        itr_data = ITRExtractor.extract(itr_only) if itr_only else {
            "avg_annual_income": 0.0, "years": 0, "confidence": 0.0}
        annual_income_itr = itr_data.get("avg_annual_income", 0.0)
        itr_years = itr_data.get("years", 0)
        itr_confidence = itr_data.get("confidence", 0.0)

        if annual_income_itr > 0:
            data_sources.append("itr_documents")
            print(f"   ✅ Annual Income (ITR): ₹{annual_income_itr:,.2f}")
            print(
                f"   ✅ Years: {itr_years} | Confidence: {itr_confidence:.0%}")
        else:
            warnings.append("Could not extract ITR income")
            print(f"   ⚠️  ITR extraction failed")

        # Extract Form 16 data (optional)
        form16_data = None
        if form16_only:
            print(f"\n   📋 Processing Form 16 documents (optional)...")
            print(f"   Expected: 2 years of Form 16 in single/multiple PDFs")

            form16_data = Form16Extractor.extract(form16_only)
            form16_gross = form16_data.get("avg_gross_salary", 0.0)
            form16_years = form16_data.get("years", 0)

            if form16_gross > 0:
                data_sources.append("form16")
                print(f"   ✅ Annual Gross (Form 16): ₹{form16_gross:,.2f}")
                print(f"   ✅ Years: {form16_years}")

                # Cross-validate ITR with Form 16
                if annual_income_itr > 0:
                    variance = abs(
                        form16_gross - annual_income_itr) / annual_income_itr
                    if variance > 0.15:  # >15% difference
                        warnings.append(
                            f"ITR vs Form 16 mismatch: ITR(₹{annual_income_itr:,.0f}) vs Form16(₹{form16_gross:,.0f})")
                    else:
                        print(f"   ✅ ITR-Form16 cross-validation passed")

                # Use Form 16 as fallback if ITR extraction failed
                if annual_income_itr == 0:
                    annual_income_itr = form16_gross
                    print(
                        f"   🔄 Using Form 16 annual income: ₹{annual_income_itr:,.2f}")
            else:
                print(f"   ⚠️  Form 16 extraction failed")
        else:
            print(f"\n   ℹ️  Form 16 not provided (optional)")

        # Cross-validate monthly income with annual tax documents
        if annual_income_itr > 0 and monthly_income > 0:
            expected_annual = monthly_income * 12
            variance = abs(annual_income_itr -
                           expected_annual) / expected_annual
            if variance > 0.25:  # >25% difference
                warnings.append(
                    f"Monthly vs Annual mismatch: Annual(₹{annual_income_itr:,.0f}) vs Expected(₹{expected_annual:,.0f})")
                print(f"   ⚠️  Income variance detected: {variance:.1%}")
            else:
                print(f"   ✅ Annual-Monthly cross-validation passed")

        # ========== STEP 4: VALIDATE DATA QUALITY ==========
        print("\n🔍 STEP 4: Validating data quality...")

        if monthly_income == 0:
            errors.append("CRITICAL: Could not determine monthly income")
            print(f"   ❌ No valid income source found")
            raise ValueError("Cannot calculate FOIR without income data")

        if len(data_sources) < 2:
            warnings.append(
                "Limited data sources - results may be less accurate")

        # Calculate overall confidence
        confidences = [salary_confidence, bank_confidence, itr_confidence]
        if form16_data and form16_data.get("confidence", 0) > 0:
            confidences.append(form16_data["confidence"])

        overall_confidence = sum(confidences) / len(confidences)

        print(f"   📊 Overall Confidence: {overall_confidence:.0%}")
        print(f"   🔎 Data Sources: {', '.join(data_sources)}")
        print(f"   📁 Documents Processed:")
        print(f"      • Salary Slips: {len(salary_slips)} PDF(s)")
        print(f"      • Bank Statement: 1 PDF")
        print(f"      • ITR: {len(itr_only)} PDF(s)")
        print(f"      • Form 16: {len(form16_only)} PDF(s)")

        # ========== STEP 5: CALCULATE FOIR ==========
        print("\n🧮 STEP 5: Calculating FOIR...")
        foir_result = FOIREngine.calculate(monthly_income, monthly_emi)
        foir_result.available_income = monthly_income - monthly_emi
        foir_result.emi_to_income_ratio = foir_result.foir

        print(
            f"   ✅ FOIR: {foir_result.foir:.2f}% ({foir_result.status.upper()})")
        print(f"   💵 Available Income: ₹{foir_result.available_income:,.2f}")

        # ========== STEP 6: ESTIMATE CIBIL ==========
        print("\n🎯 STEP 6: Estimating CIBIL...")

        # Count unique EMI sources
        emi_count = 1 if monthly_emi > 0 else 0

        cibil_estimate = CIBILEstimator.estimate(
            foir=foir_result.foir,
            bounce_count=bounce_count,
            salary_consistency=salary_months,
            emi_count=emi_count,
            monthly_income=monthly_income,
            monthly_emi=monthly_emi
        )

        print(f"   ✅ CIBIL Band: {cibil_estimate.estimated_band}")
        print(f"   ✅ Estimated Score: {cibil_estimate.estimated_score}")
        print(f"   ✅ Risk Level: {cibil_estimate.risk_level.upper()}")

        if cibil_estimate.insights:
            print(
                f"   📈 Approval Likelihood: {cibil_estimate.insights.get('approval_likelihood', 'N/A')}")

        # ========== BUILD RESULT ==========
        processing_time = time.time() - start_time

        extraction_metadata = ExtractionMetadata(
            confidence=overall_confidence,
            data_sources=data_sources,
            warnings=warnings
        )

        result = FinancialResult(
            session_id=session_id,
            foir=foir_result,
            cibil=cibil_estimate,
            processing_time_seconds=round(processing_time, 2),
            status="success" if not warnings else "partial",
            errors=errors,
            extraction_quality=extraction_metadata
        )

        print(f"\n{'='*70}")
        print(f"✅ CALCULATION COMPLETE ({processing_time:.2f}s)")
        if warnings:
            print(f"⚠️  {len(warnings)} warning(s) - see details in output")
        print(f"{'='*70}\n")

        return result

    except Exception as e:
        errors.append(str(e))
        print(f"\n❌ CRITICAL ERROR: {e}")
        print(f"{'='*70}\n")

        return FinancialResult(
            session_id=session_id,
            foir=None,
            cibil=None,
            processing_time_seconds=time.time() - start_time,
            status="failed",
            errors=errors
        )


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🧪 TESTING FOIR + CIBIL CALCULATOR v2.0")
    print("   Architecture: 4-Document System")
    print("="*70)

    # Check if sample files exist
    sample_files = {
        "salary_slips": r"C:\project-version-1\testingdata\Anil Shah- Father\salaryslip.pdf",
        "bank_statement": r"C:\project-version-1\testingdata\Anil Shah- Father\bankstatement_page-0001.pdf",
        "itr": r"C:\project-version-1\testingdata\Anil Shah- Father\itr.pdf",
        # "form16": "samples/form16_2years.pdf"
    }

    missing_files = [f"{k}: {v}" for k,
                     v in sample_files.items() if not Path(v).exists()]

    if missing_files:
        print("\n⚠️  WARNING: Sample files not found:")
        for f in missing_files:
            print(f"   - {f}")
        print("\nSkipping test run. Use API endpoint for actual testing.")
        print("="*70 + "\n")
        exit(0)

    # Test with sample PDFs
    result = calculate_foir_cibil(
        salary_slips=[sample_files["salary_slips"]],
        bank_statement=sample_files["bank_statement"],
        itr_docs=[
            sample_files["itr"],
            # sample_files["form16"]  # Optional
        ]
    )

    # Create results directory
    results_dir = Path("results")
    results_dir.mkdir(exist_ok=True)

    # Save result
    output = result.model_dump(mode='json')
    save_json(output, f"results/foir_cibil_{result.session_id}.json")

    # Display summary
    print("\n" + "="*70)
    print("📊 FINAL RESULTS")
    print("="*70)

    if result.foir:
        print(f"\n💰 FOIR: {result.foir.foir}% ({result.foir.status})")
        print(f"   Income: ₹{result.foir.monthly_income:,.2f}")
        print(f"   EMI: ₹{result.foir.monthly_emi:,.2f}")
        print(f"   Available: ₹{result.foir.available_income:,.2f}")

    if result.cibil:
        print(f"\n🎯 CIBIL: {result.cibil.estimated_band}")
        print(f"   Score: {result.cibil.estimated_score}")
        print(f"   Risk: {result.cibil.risk_level.upper()}")

    if result.extraction_quality:
        print(f"\n📊 Quality: {result.extraction_quality.confidence:.0%}")
        print(
            f"   Sources: {', '.join(result.extraction_quality.data_sources)}")

        if result.extraction_quality.warnings:
            print(f"\n⚠️  Warnings:")
            for warning in result.extraction_quality.warnings:
                print(f"   • {warning}")

    print(f"\n⏱️  Processing Time: {result.processing_time_seconds}s")
    print(f"✅ Status: {result.status.upper()}")
    print("="*70 + "\n")
