"""
CIBIL Report Chain - OPTIMIZED
✅ Async support
✅ Prompt template
"""

import logging
import asyncio
from pathlib import Path

from langchain_core.prompts import PromptTemplate
from chains.base_chain import BaseChain
from config import Config
from processors.pdf_processor import PDFProcessor
from schemas import CIBILReportData, CIBILReportExtraction

logger = logging.getLogger(__name__)


class CIBILReportChain(BaseChain):
    """OPTIMIZED: Async CIBIL extraction"""

    EXTRACTION_PROMPT = PromptTemplate.from_template("""You are extracting CIBIL credit report data from a GPay dashboard screenshot/PDF.

Extract the following information:

1. **Personal Details**: Applicant name, PAN number
2. **CIBIL Score**: Actual score (300-900), Score generation date (YYYY-MM-DD)
3. **Credit Summary**: Total/Active/Closed accounts, Overdue amount, Credit inquiries, Account age
4. **Credit Accounts** (Extract ALL): Account type, Bank name, Account number, Sanctioned amount, Outstanding balance, Payment status, Days Past Due
5. **Credit Utilization**: Total credit limit, Total outstanding, Utilization %

CRITICAL RULES:
- Extract the EXACT CIBIL score shown
- Extract ALL credit accounts visible
- Use 0.0 for missing amounts, 0 for missing counts
- Keep names/account numbers exactly as shown

The system will validate your response automatically.""")

    def __init__(self):
        super().__init__(model_name="gemini-2.0-flash-exp", temperature=0.0)

    async def process_async(self, cibil_pdf: str) -> CIBILReportData:
        """✅ ASYNC processing"""
        logger.info(
            f"🎯 [ASYNC] Processing CIBIL report: {Path(cibil_pdf).name}")

        images = PDFProcessor.process_pdf_for_gemini(
            cibil_pdf, max_pages=Config.MAX_PDF_PAGES
        )
        logger.info(f"   ✅ Loaded {len(images)} pages")

        prompt = self.EXTRACTION_PROMPT.format()

        try:
            messages = self.create_gemini_content(prompt, images)

            # ✅ Async invocation
            extraction = await self.ainvoke_structured_with_retry(
                messages,
                schema=CIBILReportExtraction
            )

            logger.info(f"   ✅ CIBIL Score: {extraction.cibil_score}")
            logger.info(f"   📊 Total Accounts: {extraction.total_accounts}")
            logger.info(
                f"   💳 Credit Utilization: {extraction.credit_utilization_percent:.1f}%")

            cibil_data = CIBILReportData(
                applicant_name=extraction.applicant_name,
                pan_number=extraction.pan_number,
                cibil_score=extraction.cibil_score,
                score_date=extraction.score_date,
                total_accounts=extraction.total_accounts,
                active_accounts=extraction.active_accounts,
                closed_accounts=extraction.closed_accounts,
                total_overdue_amount=extraction.total_overdue_amount,
                credit_inquiries_last_30_days=extraction.credit_inquiries_last_30_days,
                oldest_account_age_months=extraction.oldest_account_age_months,
                credit_accounts=extraction.credit_accounts,
                total_credit_limit=extraction.total_credit_limit,
                total_outstanding=extraction.total_outstanding,
                credit_utilization_percent=extraction.credit_utilization_percent,
                extraction_confidence=extraction.extraction_confidence,
                extraction_notes=extraction.extraction_notes
            )

            return cibil_data

        except Exception as e:
            logger.error(f"   ❌ CIBIL report extraction failed: {e}")
            raise

    def process(self, cibil_pdf: str) -> CIBILReportData:
        """Sync wrapper"""
        return asyncio.run(self.process_async(cibil_pdf))
