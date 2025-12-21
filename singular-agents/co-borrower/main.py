"""
Main Orchestration Engine for Loan Approval AI - ANALYTICS ONLY
Processes all documents in parallel - NO ELIGIBILITY DECISIONS
"""

import logging
from pathlib import Path
from typing import Optional
from datetime import datetime
import time
from concurrent.futures import ThreadPoolExecutor

from chains.bank_chain import BankStatementChain
from chains.itr_chain import ITRChain
from chains.salary_chain import SalarySlipChain
from chains.foir_chain import FOIRChain
from chains.cibil_chain import CIBILChain
from schemas import LoanApplicationAnalysis
from utils import (
    save_json, create_session_id, validate_pdf,
    calculate_confidence_score, setup_logging
)
from config import Config

# Setup logging
setup_logging(Config.LOG_LEVEL)
logger = logging.getLogger(__name__)


class LoanApprovalEngine:
    """Main orchestration engine for loan application analysis - ANALYTICS ONLY"""

    def __init__(self):
        """Initialize all chains"""
        logger.info("🚀 Initializing Loan Approval Engine...")
        self.itr_chain = ITRChain()
        self.bank_chain = BankStatementChain()
        self.salary_chain = SalarySlipChain()
        self.foir_chain = FOIRChain()
        self.cibil_chain = CIBILChain()
        logger.info("✅ All chains initialized")

    def process_loan_application(
        self,
        salary_slip_pdf: str,
        bank_statement_pdf: str,
        itr_pdf_1: str,
        itr_pdf_2: Optional[str] = None,
        form16_pdf: Optional[str] = None
    ) -> LoanApplicationAnalysis:
        """
        Process complete loan application - RETURNS DATA ONLY, NO DECISIONS

        Args:
            salary_slip_pdf: Path to salary slips (3 months)
            bank_statement_pdf: Path to bank statement (6 months)
            itr_pdf_1: Path to ITR document 1
            itr_pdf_2: Path to ITR document 2 (optional)
            form16_pdf: Path to Form 16 (optional)

        Returns:
            LoanApplicationAnalysis: Complete analysis (data + FOIR + CIBIL only)
        """
        session_id = create_session_id()
        start_time = time.time()

        logger.info(f"\n{'='*80}")
        logger.info(f"💰 LOAN APPLICATION ANALYSIS - Session: {session_id}")
        logger.info(f"{'='*80}\n")

        errors = []

        try:
            # Validate all PDFs
            logger.info("📋 Step 1: Validating input documents...")
            pdf_files = {
                "Salary Slip": salary_slip_pdf,
                "Bank Statement": bank_statement_pdf,
                "ITR 1": itr_pdf_1
            }

            if itr_pdf_2:
                pdf_files["ITR 2"] = itr_pdf_2
            if form16_pdf:
                pdf_files["Form 16"] = form16_pdf

            for doc_name, pdf_path in pdf_files.items():
                if not validate_pdf(pdf_path):
                    raise ValueError(f"Invalid PDF: {doc_name}")

            logger.info("   ✅ All documents validated\n")

            # Process documents in parallel
            logger.info(
                "📊 Step 2: Extracting data from all documents (parallel processing)...")
            itr_data = None
            bank_data = None
            salary_data = None

            with ThreadPoolExecutor(max_workers=3) as executor:
                # Submit all tasks
                futures = {}

                # ITR extraction
                itr_pdfs = [itr_pdf_1]
                if itr_pdf_2:
                    itr_pdfs.append(itr_pdf_2)
                if form16_pdf:
                    itr_pdfs.append(form16_pdf)
                futures['itr'] = executor.submit(
                    self.itr_chain.process, itr_pdfs)

                # Bank statement extraction
                futures['bank'] = executor.submit(
                    self.bank_chain.process, bank_statement_pdf)

                # Salary slip extraction
                futures['salary'] = executor.submit(
                    self.salary_chain.process, salary_slip_pdf)

                # Wait for all to complete
                for name, future in futures.items():
                    try:
                        if name == 'itr':
                            itr_data = future.result()
                        elif name == 'bank':
                            bank_data = future.result()
                        elif name == 'salary':
                            salary_data = future.result()
                    except Exception as e:
                        logger.error(
                            f"   ❌ {name.upper()} extraction failed: {e}")
                        errors.append(f"{name} extraction failed: {str(e)}")

            logger.info("   ✅ All extractions completed\n")

            # Calculate FOIR
            logger.info("💵 Step 3: Calculating FOIR...")
            foir_result = None
            try:
                foir_result = self.foir_chain.calculate_foir(
                    itr_data, bank_data, salary_data
                )
                logger.info("   ✅ FOIR calculated\n")
            except Exception as e:
                logger.error(f"   ❌ FOIR calculation failed: {e}")
                errors.append(f"FOIR calculation failed: {str(e)}")

            # Estimate CIBIL
            logger.info("🎯 Step 4: Estimating CIBIL score...")
            cibil_estimate = None
            try:
                cibil_estimate = self.cibil_chain.estimate_cibil(
                    bank_data, foir_result
                )
                logger.info("   ✅ CIBIL estimated\n")
            except Exception as e:
                logger.error(f"   ❌ CIBIL estimation failed: {e}")
                errors.append(f"CIBIL estimation failed: {str(e)}")

            # Calculate overall confidence
            confidence_scores = []
            if itr_data:
                confidence_scores.append(itr_data.extraction_confidence)
            if bank_data:
                confidence_scores.append(bank_data.extraction_confidence)
            if salary_data:
                confidence_scores.append(salary_data.extraction_confidence)

            overall_confidence = calculate_confidence_score(confidence_scores)

            # Determine data sources used
            data_sources = []
            missing_data = []

            if itr_data and itr_data.extraction_confidence > 0.5:
                data_sources.append("ITR Documents")
            else:
                missing_data.append("ITR Documents")

            if bank_data and bank_data.extraction_confidence > 0.5:
                data_sources.append("Bank Statement")
            else:
                missing_data.append("Bank Statement")

            if salary_data and salary_data.extraction_confidence > 0.5:
                data_sources.append("Salary Slips")
            else:
                missing_data.append("Salary Slips")

            # Processing time
            processing_time = time.time() - start_time

            # Determine status (simple: success/partial/failed)
            if errors:
                status = "failed" if len(errors) >= 3 else "partial"
            elif missing_data:
                status = "partial"
            else:
                status = "success"

            # Create final result - DATA ONLY, NO DECISIONS
            result = LoanApplicationAnalysis(
                session_id=session_id,
                timestamp=datetime.now(),
                itr_data=itr_data,
                bank_data=bank_data,
                salary_data=salary_data,
                foir_result=foir_result,
                cibil_estimate=cibil_estimate,
                overall_confidence=overall_confidence,
                data_sources_used=data_sources,
                missing_data=missing_data,
                processing_time_seconds=processing_time,
                status=status,
                errors=errors
            )

            # Save result
            output_path = Config.RESULTS_DIR / \
                f"loan_analysis_{session_id}.json"
            save_json(result.model_dump(mode='json'), str(output_path))

            # Print summary
            self._print_summary(result)

            return result

        except Exception as e:
            logger.error(f"\n❌ CRITICAL ERROR: {e}", exc_info=True)
            # Return error result
            return LoanApplicationAnalysis(
                session_id=session_id,
                timestamp=datetime.now(),
                overall_confidence=0.0,
                data_sources_used=[],
                missing_data=["All documents"],
                processing_time_seconds=time.time() - start_time,
                status="failed",
                errors=[str(e)]
            )

    def _print_summary(self, result: LoanApplicationAnalysis):
        """Print analysis summary - DATA ONLY"""
        logger.info(f"\n{'='*80}")
        logger.info(f"📊 LOAN APPLICATION ANALYSIS SUMMARY")
        logger.info(f"{'='*80}")
        logger.info(f"\n📋 Session: {result.session_id}")
        logger.info(
            f"⏱️  Processing Time: {result.processing_time_seconds:.2f}s")
        logger.info(f"✅ Status: {result.status.upper()}")
        logger.info(f"📊 Overall Confidence: {result.overall_confidence:.0%}")

        # Data sources
        if result.data_sources_used:
            logger.info(f"\n📁 DATA SOURCES:")
            for source in result.data_sources_used:
                logger.info(f"   ✅ {source}")

        if result.missing_data:
            logger.info(f"\n❌ MISSING DATA:")
            for missing in result.missing_data:
                logger.info(f"   • {missing}")

        # ITR Data
        if result.itr_data:
            logger.info(f"\n📊 ITR DATA:")
            logger.info(f"   Applicant: {result.itr_data.applicant_name}")
            logger.info(
                f"   Average Annual Income: ₹{result.itr_data.average_annual_income:,.2f}")
            logger.info(
                f"   Average Monthly Income: ₹{result.itr_data.average_monthly_income:,.2f}")
            logger.info(
                f"   Income Growth: {result.itr_data.income_growth_rate:.1f}%")

        # Bank Data
        if result.bank_data:
            logger.info(f"\n🏦 BANK STATEMENT DATA:")
            logger.info(
                f"   Account Holder: {result.bank_data.account_holder_name}")
            logger.info(
                f"   Average Monthly Balance: ₹{result.bank_data.average_monthly_balance:,.2f}")
            logger.info(
                f"   Average Monthly Salary: ₹{result.bank_data.average_monthly_salary:,.2f}")
            logger.info(
                f"   Average Monthly EMI: ₹{result.bank_data.average_monthly_emi:,.2f}")
            logger.info(f"   Bounce Count: {result.bank_data.bounce_count}")

        # Salary Data
        if result.salary_data:
            logger.info(f"\n💼 SALARY SLIP DATA:")
            logger.info(f"   Employee: {result.salary_data.employee_name}")
            logger.info(f"   Employer: {result.salary_data.employer_name}")
            logger.info(
                f"   Average Gross Salary: ₹{result.salary_data.average_gross_salary:,.2f}")
            logger.info(
                f"   Average Net Salary: ₹{result.salary_data.average_net_salary:,.2f}")

        # FOIR Results
        if result.foir_result:
            logger.info(f"\n💰 FOIR ANALYSIS:")
            logger.info(
                f"   FOIR: {result.foir_result.foir_percentage}% ({result.foir_result.foir_status.value})")
            logger.info(
                f"   Monthly Gross Income: ₹{result.foir_result.monthly_gross_income:,.2f}")
            logger.info(
                f"   Monthly Net Income: ₹{result.foir_result.monthly_net_income:,.2f}")
            logger.info(
                f"   Monthly EMI: ₹{result.foir_result.total_monthly_emi:,.2f}")
            logger.info(
                f"   Available Income: ₹{result.foir_result.available_monthly_income:,.2f}")
            logger.info(
                f"   DSCR: {result.foir_result.debt_service_coverage_ratio:.2f}")

        # CIBIL Estimate
        if result.cibil_estimate:
            logger.info(f"\n🎯 CIBIL ESTIMATION:")
            logger.info(
                f"   Estimated Score: {result.cibil_estimate.estimated_score}")
            logger.info(f"   Band: {result.cibil_estimate.estimated_band}")
            logger.info(
                f"   Risk Level: {result.cibil_estimate.risk_level.value}")

            if result.cibil_estimate.positive_factors:
                logger.info(f"\n   ✅ Positive Factors:")
                for factor in result.cibil_estimate.positive_factors:
                    logger.info(f"      • {factor}")

            if result.cibil_estimate.negative_factors:
                logger.info(f"\n   ❌ Negative Factors:")
                for factor in result.cibil_estimate.negative_factors:
                    logger.info(f"      • {factor}")

        # Errors
        if result.errors:
            logger.info(f"\n⚠️  ERRORS:")
            for error in result.errors:
                logger.info(f"   • {error}")

        logger.info(f"\n{'='*80}\n")

# ============================================================================
# TESTING
# ============================================================================


if __name__ == "__main__":
    print("\n" + "="*80)
    print("🧪 TESTING LOAN APPROVAL AI ENGINE (ANALYTICS ONLY)")
    print("="*80)

    # Sample file paths - UPDATE THESE TO YOUR ACTUAL FILES
    test_files = {
        "salary_slip": Path(r"C:\project-version-1\testingdata\Anil Shah- Father\salaryslip.pdf"),
        "bank_statement": Path(r"C:\project-version-1\testingdata\Anil Shah- Father\bankstatement_page-0001.pdf"),
        "itr_1": Path(r"C:\project-version-1\testingdata\Anil Shah- Father\itr1_page-0001.pdf"),
        "itr_2": Path(r"C:\project-version-1\testingdata\Anil Shah- Father\itr3_page-0001.pdf"),
    }

    # Check if files exist
    missing = [name for name, path in test_files.items() if not path.exists()]
    if missing:
        print(f"\n⚠️  Missing test files: {', '.join(missing)}")
        print("\nPlease update file paths in main.py or place test files in testingdata/")
        print("="*80 + "\n")
        exit(0)

    # Initialize engine
    engine = LoanApprovalEngine()

    # Process application
    result = engine.process_loan_application(
        salary_slip_pdf=str(test_files["salary_slip"]),
        bank_statement_pdf=str(test_files["bank_statement"]),
        itr_pdf_1=str(test_files["itr_1"]),
        # itr_pdf_2=str(test_files.get("itr_2")) if "itr_2" in test_files else None,
    )

    print("\n" + "="*80)
    print("✅ TEST COMPLETE")
    print("="*80 + "\n")
