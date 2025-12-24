"""
ITR Chain - FIXED PROMPT
✅ Explicit instructions to extract yearly_data array
✅ Better year detection
"""

import logging
import asyncio
from pathlib import Path
from typing import List

from langchain_core.prompts import PromptTemplate
from chains.base_chain import BaseChain
from config import Config
from processors.pdf_processor import PDFProcessor
from schemas import ITRData, ITRExtraction

logger = logging.getLogger(__name__)


class ITRChain(BaseChain):
    """ITR extraction with improved prompt"""

    # ✅ IMPROVED PROMPT
    EXTRACTION_PROMPT = PromptTemplate.from_template("""You are extracting Income Tax Return (ITR) data for loan application analysis.

**CRITICAL**: You MUST populate the yearly_data array with data for EACH year present in the ITR documents.

Extract the following information:

1. **Taxpayer Details**:
   - taxpayer_name: Full name as per PAN
   - pan_number: PAN number (10 characters)

2. **Yearly Data Array** (FOR EACH ASSESSMENT YEAR):
   For EACH year in the ITR documents, add an entry to yearly_data with:
   - assessment_year: e.g., "2023-24", "2022-23" (MUST be in this format)
   - gross_total_income: Total income before deductions
   - total_income_after_deductions: Taxable income after deductions
   - tax_paid: Total tax paid (including TDS, advance tax)
   - filing_date: Date of filing (YYYY-MM-DD format)
   - filing_status: "filed" or "verified"
   - salary_income: Income from salary (if applicable)
   - business_income: Income from business/profession (if applicable)
   - other_income: Other sources of income

**EXAMPLE of yearly_data**:
```json
[
  {
    "assessment_year": "2023-24",
    "gross_total_income": 1200000.0,
    "total_income_after_deductions": 1000000.0,
    "tax_paid": 150000.0,
    "filing_date": "2024-07-31",
    "filing_status": "verified",
    "salary_income": 1200000.0,
    "business_income": 0.0,
    "other_income": 0.0
  },
  {
    "assessment_year": "2022-23",
    "gross_total_income": 1100000.0,
    ...
  }
]
```

**IMPORTANT RULES**:
- yearly_data MUST NOT be empty - extract ALL years present
- If 2 ITR PDFs are provided, extract data for BOTH years
- assessment_year format: "YYYY-YY" (e.g., "2023-24")
- All income amounts should be > 0 if visible in the document
- Use 0.0 only if the field is genuinely not applicable

**NOTE**: The system will automatically calculate:
- years_filed (count of years)
- average_annual_income (average of gross_total_income)
- average_monthly_income (average_annual_income / 12)
- income_trend (increasing/stable/decreasing)

Do NOT set these fields yourself - just provide the yearly_data array with ALL years.

The system will validate your response automatically.""")

    def __init__(self):
        super().__init__(model_name="gemini-2.0-flash-exp", temperature=0.0)

    async def process_async(self, itr_pdfs: List[str]) -> ITRData:
        """ASYNC processing with parallel PDF loading"""
        logger.info(f"📄 [ASYNC] Processing {len(itr_pdfs)} ITR document(s)")

        # Load PDFs in parallel
        async def load_pdf(pdf_path: str):
            return await asyncio.to_thread(
                PDFProcessor.process_pdf_for_gemini,
                pdf_path,
                max_pages=Config.MAX_PDF_PAGES
            )

        all_images_lists = await asyncio.gather(*[load_pdf(pdf) for pdf in itr_pdfs])

        # Flatten images
        all_images = []
        for images in all_images_lists:
            all_images.extend(images)
            logger.info(f"   ✅ Loaded {len(images)} pages")

        prompt = self.EXTRACTION_PROMPT.format()

        try:
            messages = self.create_gemini_content(prompt, all_images)

            # Async invocation
            extraction = await self.ainvoke_structured_with_retry(
                messages,
                schema=ITRExtraction
            )

            # ✅ The @model_validator in ITRExtraction will auto-calculate metrics
            logger.info(f"   ✅ Extracted {len(extraction.yearly_data)} year(s)")
            logger.info(f"   💰 Average Annual Income: ₹{extraction.average_annual_income:,.2f}")
            logger.info(f"   📊 Income Trend: {extraction.income_trend.value}")

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
            logger.error(f"   ❌ ITR extraction failed: {e}")
            raise

    def process(self, itr_pdfs: List[str]) -> ITRData:
        """Sync wrapper"""
        return asyncio.run(self.process_async(itr_pdfs))