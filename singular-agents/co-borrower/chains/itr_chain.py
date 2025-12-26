"""
ITR Extraction Chain - PRODUCTION READY
"""

import logging
from pathlib import Path
from typing import List
import json
import re

from chains.base_chain import BaseChain
from schemas import ITRData
from processors.pdf_processor import PDFProcessor
from config import Config

logger = logging.getLogger(__name__)


class ITRChain(BaseChain):
    """Extract structured data from ITR documents"""

    def __init__(self):
        super().__init__(model_name=Config.GEMINI_VISION_MODEL)

    def create_extraction_prompt(self) -> str:
        """Create detailed ITR extraction prompt"""
        return """EXTRACT ITR DATA FOR LOAN APPLICATION - Return ONLY valid JSON

Extract data from TWO YEARS of ITR documents. Return ONLY the JSON object, NO markdown, NO explanations.

# FIELDS TO EXTRACT:
- applicant_name, pan_number
- assessment_year_1 (e.g., "2023-24"), assessment_year_2 (e.g., "2022-23")
- gross_total_income_year1, deductions_year1, taxable_income_year1, tax_paid_year1
- gross_total_income_year2, deductions_year2, taxable_income_year2, tax_paid_year2
- average_annual_income, average_monthly_income, income_growth_rate
- itr_form_type (ITR-1, ITR-2, etc.), filing_status
- extraction_confidence (0.0-1.0), extraction_notes (list)

# OUTPUT FORMAT (exact structure required):
{
  "applicant_name": "string",
  "pan_number": null,
  "assessment_year_1": "2023-24",
  "assessment_year_2": "2022-23",
  "gross_total_income_year1": 0.0,
  "deductions_year1": 0.0,
  "taxable_income_year1": 0.0,
  "tax_paid_year1": 0.0,
  "gross_total_income_year2": 0.0,
  "deductions_year2": 0.0,
  "taxable_income_year2": 0.0,
  "tax_paid_year2": 0.0,
  "average_annual_income": 0.0,
  "average_monthly_income": 0.0,
  "income_growth_rate": 0.0,
  "itr_form_type": "ITR-1",
  "filing_status": "e-verified",
  "extraction_confidence": 0.0,
  "extraction_notes": []
}

Analyze the ITR documents and return ONLY the JSON:"""

    def process(self, itr_pdfs: List[str]) -> ITRData:
        """Process ITR documents"""
        logger.info(f"📊 Processing {len(itr_pdfs)} ITR document(s)")

        try:
            # Process all PDFs
            all_images = []
            for pdf_path in itr_pdfs:
                logger.info(f"   📄 Processing: {Path(pdf_path).name}")
                images = PDFProcessor.process_pdf_for_gemini(
                    pdf_path, max_pages=10)
                all_images.extend(images)

            logger.info(f"   ✅ Total pages to analyze: {len(all_images)}")

            # Create prompt
            prompt = self.create_extraction_prompt()

            # FIXED: Use proper Gemini content format
            messages = self.create_gemini_content(prompt, all_images)

            # Invoke model
            logger.info("   🤖 Analyzing ITR documents with Gemini...")
            response = self.llm.invoke(messages)

            # Parse response
            logger.info("   📝 Parsing structured output...")
            parsed_data = self._parse_response(response.content)

            logger.info(f"   ✅ ITR extraction complete!")
            logger.info(f"      Applicant: {parsed_data.applicant_name}")
            logger.info(
                f"      Average Annual Income: ₹{parsed_data.average_annual_income:,.2f}")
            logger.info(
                f"      Average Monthly Income: ₹{parsed_data.average_monthly_income:,.2f}")
            logger.info(
                f"      Confidence: {parsed_data.extraction_confidence:.0%}")

            return parsed_data

        except Exception as e:
            logger.error(f"   ❌ ITR extraction failed: {e}")
            logger.exception("Full traceback:")
            # Return minimal structure
            return ITRData(
                applicant_name="Extraction Failed",
                assessment_year_1="2023-24",
                assessment_year_2="2022-23",
                gross_total_income_year1=0.0,
                taxable_income_year1=0.0,
                gross_total_income_year2=0.0,
                taxable_income_year2=0.0,
                average_annual_income=0.0,
                average_monthly_income=0.0,
                income_growth_rate=0.0,
                itr_form_type="Unknown",
                filing_status="Unknown",
                extraction_confidence=0.0,
                extraction_notes=[f"Error: {str(e)}"]
            )

    def _parse_response(self, response_text: str) -> ITRData:
        """Parse LLM response into ITRData"""
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
            cleaned = re.sub(r',(\s*[}\]])', r'\1', cleaned)

            # Parse JSON
            data = json.loads(cleaned)

            # Create ITRData object
            return ITRData(**data)

        except Exception as e:
            logger.error(f"      ❌ Failed to parse response: {e}")
            logger.error(f"      📝 Response text: {response_text[:500]}...")
            raise
