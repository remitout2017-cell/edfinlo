"""
Salary Slip Chain - PRODUCTION READY with Structured Output
✅ NO JSON PARSING ERRORS
"""
import logging
from pathlib import Path
from typing import List
from chains.base_chain import BaseChain
from config import Config
from processors.pdf_processor import PDFProcessor
from schemas import SalarySlipData, SalarySlipExtraction

logger = logging.getLogger(__name__)


class SalarySlipChain(BaseChain):
    """Extract salary slip data using structured output"""

    def __init__(self):
        super().__init__(model_name="gemini-2.0-flash-exp", temperature=0.0)

    def _create_extraction_prompt(self) -> str:
        """Create prompt for structured salary extraction"""
        return """You are extracting salary slip data for loan application analysis.

Extract the following from ALL salary slips (typically 3 months):

1. **Employee Details**: name, employee ID, designation, department
2. **Company Details**: employer name, company address
3. **Each Month's Data**:
   - Month and year
   - Gross salary
   - Net salary (take-home)
   - Total deductions
   - Basic salary
   - HRA (House Rent Allowance)
   - Other allowances
   - PF (Provident Fund) deduction
   - Tax deduction (TDS)

4. **Salary Consistency**: Identify if salary is consistent across months

CRITICAL RULES:
- Extract ALL months present
- Use 0.0 for missing amounts
- Keep names/designations exactly as shown
- Calculate averages carefully

The system will validate your response automatically."""

    def process(self, salary_slip_pdf: str) -> SalarySlipData:
        """
        Process salary slips with structured output.

        Args:
            salary_slip_pdf: Path to salary slip PDF (3 months combined)

        Returns:
            SalarySlipData with validated data
        """
        logger.info(f"💼 Processing salary slips: {Path(salary_slip_pdf).name}")

        # Convert PDF to images
        images = PDFProcessor.process_pdf_for_gemini(
            salary_slip_pdf, max_pages=Config.MAX_PDF_PAGES)
        logger.info(f"  ✅ Loaded {len(images)} pages")

        prompt = self._create_extraction_prompt()

        try:
            # Create multimodal content
            messages = self.create_gemini_content(prompt, images)

            # ✅ Invoke with structured output
            extraction = self.invoke_structured_with_retry(
                messages,
                schema=SalarySlipExtraction
            )

            logger.info(
                f"  ✅ Extracted {len(extraction.monthly_salaries)} months")
            logger.info(
                f"  💵 Average Net Salary: ₹{extraction.average_net_salary:,.2f}")

            # Convert to final SalarySlipData
            salary_data = SalarySlipData(
                employee_name=extraction.employee_name,
                employee_id=extraction.employee_id,
                designation=extraction.designation,
                department=extraction.department,
                employer_name=extraction.employer_name,
                company_address=extraction.company_address,
                monthly_salaries=extraction.monthly_salaries,
                average_gross_salary=extraction.average_gross_salary,
                average_net_salary=extraction.average_net_salary,
                average_deductions=extraction.average_deductions,
                salary_consistency_months=extraction.salary_consistency_months,
                last_salary_month=extraction.last_salary_month,
                extraction_confidence=extraction.extraction_confidence,
                extraction_notes=extraction.extraction_notes
            )

            return salary_data

        except Exception as e:
            logger.error(f"  ❌ Salary extraction failed: {e}")
            raise
