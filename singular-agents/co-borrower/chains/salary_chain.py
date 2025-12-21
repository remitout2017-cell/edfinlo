"""
Salary Slip Extraction Chain - PRODUCTION READY
"""

import logging
from pathlib import Path
import json
import re

from chains.base_chain import BaseChain
from schemas import SalarySlipData, EmploymentType
from processors.pdf_processor import PDFProcessor
from config import Config

logger = logging.getLogger(__name__)


class SalarySlipChain(BaseChain):
    """Extract structured data from salary slips"""

    def __init__(self):
        super().__init__(model_name=Config.GEMINI_VISION_MODEL)

    def create_extraction_prompt(self) -> str:
        """Create detailed salary slip extraction prompt"""
        return """EXTRACT SALARY SLIP DATA FOR LOAN APPLICATION - Return ONLY valid JSON

Extract data from 3 months of salary slips. Return ONLY the JSON object, NO markdown, NO explanations.

# FIELDS TO EXTRACT:
- employee_name, employee_id, employer_name, designation, employment_type
- month_1_date (YYYY-MM), month_1_gross, month_1_deductions, month_1_net
- month_2_date (YYYY-MM), month_2_gross, month_2_deductions, month_2_net
- month_3_date (YYYY-MM), month_3_gross, month_3_deductions, month_3_net
- average_gross_salary, average_net_salary, average_deductions
- basic_salary, hra, special_allowance, other_allowances
- pf_deduction, professional_tax, tds
- salary_consistency (0.0-1.0), has_salary_growth (true/false)
- extraction_confidence (0.0-1.0), extraction_notes (list)

# OUTPUT FORMAT (exact structure required):
{
  "employee_name": "string",
  "employee_id": null,
  "employer_name": "string",
  "designation": null,
  "employment_type": "salaried",
  "month_1_date": "YYYY-MM",
  "month_1_gross": 0.0,
  "month_1_deductions": 0.0,
  "month_1_net": 0.0,
  "month_2_date": "YYYY-MM",
  "month_2_gross": 0.0,
  "month_2_deductions": 0.0,
  "month_2_net": 0.0,
  "month_3_date": "YYYY-MM",
  "month_3_gross": 0.0,
  "month_3_deductions": 0.0,
  "month_3_net": 0.0,
  "average_gross_salary": 0.0,
  "average_net_salary": 0.0,
  "average_deductions": 0.0,
  "basic_salary": 0.0,
  "hra": 0.0,
  "special_allowance": 0.0,
  "other_allowances": 0.0,
  "pf_deduction": 0.0,
  "professional_tax": 0.0,
  "tds": 0.0,
  "salary_consistency": 0.0,
  "has_salary_growth": false,
  "extraction_confidence": 0.0,
  "extraction_notes": []
}

Analyze the salary slip pages and return ONLY the JSON:"""

    def process(self, salary_slip_pdf: str) -> SalarySlipData:
        """Process salary slips PDF"""
        logger.info(f"💼 Processing salary slips: {Path(salary_slip_pdf).name}")

        try:
            # Process PDF to images
            images = PDFProcessor.process_pdf_for_gemini(
                salary_slip_pdf, max_pages=15)
            logger.info(f"   ✅ Loaded {len(images)} pages")

            # Create prompt
            prompt = self.create_extraction_prompt()

            # FIXED: Use proper Gemini content format
            messages = self.create_gemini_content(prompt, images)

            # Invoke model
            logger.info("   🤖 Analyzing salary slips with Gemini...")
            response = self.llm.invoke(messages)

            # Parse response
            logger.info("   📝 Parsing structured output...")
            parsed_data = self._parse_response(response.content)

            logger.info(f"   ✅ Salary slip extraction complete!")
            logger.info(f"      Employee: {parsed_data.employee_name}")
            logger.info(f"      Employer: {parsed_data.employer_name}")
            logger.info(
                f"      Average Net Salary: ₹{parsed_data.average_net_salary:,.2f}")
            logger.info(
                f"      Confidence: {parsed_data.extraction_confidence:.0%}")

            return parsed_data

        except Exception as e:
            logger.error(f"   ❌ Salary slip extraction failed: {e}")
            logger.exception("Full traceback:")
            # Return minimal structure
            return SalarySlipData(
                employee_name="Extraction Failed",
                employer_name="Unknown",
                employment_type=EmploymentType.SALARIED,
                month_1_date="2024-06",
                month_1_gross=0.0,
                month_1_deductions=0.0,
                month_1_net=0.0,
                month_2_date="2024-05",
                month_2_gross=0.0,
                month_2_deductions=0.0,
                month_2_net=0.0,
                month_3_date="2024-04",
                month_3_gross=0.0,
                month_3_deductions=0.0,
                month_3_net=0.0,
                average_gross_salary=0.0,
                average_net_salary=0.0,
                average_deductions=0.0,
                basic_salary=0.0,
                salary_consistency=0.0,
                has_salary_growth=False,
                extraction_confidence=0.0,
                extraction_notes=[f"Error: {str(e)}"]
            )

    def _parse_response(self, response_text: str) -> SalarySlipData:
        """Parse LLM response into SalarySlipData with robust error handling"""
        try:
            # Clean response
            cleaned = response_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            # Extract JSON boundaries
            start = cleaned.find('{')
            end = cleaned.rfind('}')
            if start != -1 and end != -1:
                cleaned = cleaned[start:end+1]

            # Fix common JSON issues
            cleaned = re.sub(r',(\s*[}\]])', r'\1', cleaned)  # Trailing commas

            # Parse JSON
            data = json.loads(cleaned)

            # Create SalarySlipData object
            return SalarySlipData(**data)

        except Exception as e:
            logger.error(f"      ❌ Failed to parse response: {e}")
            logger.error(f"      📝 Response text: {response_text[:500]}...")
            raise
