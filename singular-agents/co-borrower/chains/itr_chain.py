"""
ITR Chain - PRODUCTION READY with Structured Output
✅ NO JSON PARSING ERRORS
"""
import logging
from pathlib import Path
from typing import List, Optional
from chains.base_chain import BaseChain
from config import Config
from processors.pdf_processor import PDFProcessor
from schemas import ITRData, ITRExtraction

logger = logging.getLogger(__name__)


class ITRChain(BaseChain):
    """Extract ITR data using structured output"""

    def __init__(self):
        super().__init__(model_name="gemini-2.0-flash-exp", temperature=0.0)

    def _create_extraction_prompt(self) -> str:
        """Create prompt for structured ITR extraction"""
        return """You are extracting Income Tax Return (ITR) data for loan application analysis.

Extract the following from ALL ITR documents provided (typically 2 years):

1. **Taxpayer Details**: name, PAN number
2. **For Each Financial Year**:
   - Assessment year (e.g., 2023-24)
   - Gross total income
   - Total income after deductions
   - Tax paid
   - Filing date
   - Filing status (filed/verified)

3. **Income Sources**: salary, business income, other sources
4. **Key Deductions**: Section 80C, home loan interest, etc.

CRITICAL RULES:
- Extract data for ALL years present (1-2 ITRs)
- Use 0.0 for missing amounts
- Keep PAN/names exactly as shown
- Calculate year-over-year growth if multiple years

The system will validate your response automatically."""

    def process(self, itr_pdfs: List[str]) -> ITRData:
        """
        Process ITR PDFs with structured output.

        Args:
            itr_pdfs: List of ITR PDF paths (1-2 years)

        Returns:
            ITRData with validated data
        """
        logger.info(f"📄 Processing {len(itr_pdfs)} ITR document(s)")

        all_images = []
        for pdf_path in itr_pdfs:
            images = PDFProcessor.process_pdf_for_gemini(
                pdf_path, max_pages=Config.MAX_PDF_PAGES)
            all_images.extend(images)
            logger.info(
                f"  ✅ Loaded {Path(pdf_path).name}: {len(images)} pages")

        prompt = self._create_extraction_prompt()

        try:
            # Create multimodal content
            messages = self.create_gemini_content(prompt, all_images)

            # ✅ Invoke with structured output
            extraction = self.invoke_structured_with_retry(
                messages,
                schema=ITRExtraction
            )

            logger.info(f"  ✅ Extracted {len(extraction.yearly_data)} year(s)")
            logger.info(
                f"  💰 Average Annual Income: ₹{extraction.average_annual_income:,.2f}")

            # Convert to final ITRData
            itr_data = ITRData(
                taxpayer_name=extraction.taxpayer_name,
                pan_number=extraction.pan_number,
                yearly_data=extraction.yearly_data,
                years_filed=extraction.years_filed,
                average_annual_income=extraction.average_annual_income,
                average_monthly_income=extraction.average_monthly_income,
                income_trend=extraction.income_trend,
                tax_compliance_score=extraction.tax_compliance_score,
                extraction_confidence=extraction.extraction_confidence,
                extraction_notes=extraction.extraction_notes
            )

            return itr_data

        except Exception as e:
            logger.error(f"  ❌ ITR extraction failed: {e}")
            raise
