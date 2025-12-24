"""
Salary Slip Chain - FIXED PROMPT
✅ Better instruction to extract ALL months
✅ Clearer field descriptions
"""

import logging
import asyncio
from pathlib import Path

from langchain_core.prompts import PromptTemplate
from chains.base_chain import BaseChain
from config import Config
from processors.pdf_processor import PDFProcessor
from schemas import SalarySlipData, SalarySlipExtraction

logger = logging.getLogger(__name__)


class SalarySlipChain(BaseChain):
    """Salary slip extraction with improved prompt"""

    # ✅ IMPROVED PROMPT with clearer instructions
    EXTRACTION_PROMPT = PromptTemplate.from_template("""You are extracting salary slip data for loan application analysis.

**CRITICAL**: You MUST extract data for ALL months present in the salary slip PDF. Typically there are 3 months.

Extract the following information:

1. **Employee Details**:
   - employee_name: Full name of employee
   - employee_id: Employee ID number
   - designation: Job title/position
   - department: Department name
   
2. **Company Details**:
   - employer_name: Company/Employer name (VERY IMPORTANT for salary detection)
   - company_address: Full company address

3. **Monthly Salary Data** (FOR EACH MONTH PRESENT):
   For each month, extract:
   - month: Month and year (e.g., "February 2025", "January 2025")
   - gross_salary: Total gross salary BEFORE deductions
   - net_salary: Take-home salary AFTER all deductions (THIS IS CRITICAL)
   - total_deductions: Sum of all deductions
   - basic_salary: Basic pay component
   - hra: House Rent Allowance
   - other_allowances: Other allowances
   - pf_deduction: Provident Fund deduction
   - tax_deduction: TDS/Tax deducted

**IMPORTANT RULES**:
- Extract ALL months visible in the PDF (usually 3 months)
- net_salary is the FINAL take-home amount - this is what employee receives
- Use exact numbers from the slip, don't estimate
- If a field is not visible, use 0.0 (but gross_salary and net_salary should ALWAYS be > 0)
- Keep names/designations exactly as shown in the document

**NOTE**: The system will automatically calculate:
- average_gross_salary (from all months)
- average_net_salary (from all months)  
- average_deductions (from all months)
- salary_consistency_months (count of months)

Do NOT set these fields yourself - just provide the monthly_salaries array.

The system will validate your response automatically.""")

    def __init__(self):
        super().__init__(model_name="gemini-2.0-flash-exp", temperature=0.0)

    async def process_async(self, salary_slip_pdf: str) -> SalarySlipData:
        """ASYNC processing"""
        logger.info(
            f"💼 [ASYNC] Processing salary slips: {Path(salary_slip_pdf).name}")

        # Convert PDF to images
        images = PDFProcessor.process_pdf_for_gemini(
            salary_slip_pdf, max_pages=Config.MAX_PDF_PAGES
        )
        logger.info(f"   ✅ Loaded {len(images)} pages")

        prompt = self.EXTRACTION_PROMPT.format()

        try:
            messages = self.create_gemini_content(prompt, images)

            # Async invocation
            extraction = await self.ainvoke_structured_with_retry(
                messages,
                schema=SalarySlipExtraction
            )

            # ✅ The @model_validator in SalarySlipExtraction will auto-calculate averages
            logger.info(
                f"   ✅ Extracted {len(extraction.monthly_salaries)} months")
            logger.info(
                f"   💵 Average Net Salary: ₹{extraction.average_net_salary:,.2f}")

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
            logger.error(f"   ❌ Salary extraction failed: {e}")
            raise

    def process(self, salary_slip_pdf: str) -> SalarySlipData:
        """Sync wrapper"""
        return asyncio.run(self.process_async(salary_slip_pdf))
