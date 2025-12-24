"""
Bank Statement Chain - PRODUCTION READY with Structured Output
✅ NO MORE JSON PARSING ERRORS - Uses Pydantic schemas directly
"""
from __future__ import annotations
import logging
from pathlib import Path
from typing import List
from chains.base_chain import BaseChain
from config import Config
from processors.pdf_processor import PDFProcessor
from schemas import BankStatementData, BankTransaction, BankStatementExtraction
from bank_metrics import compute_bank_metrics

logger = logging.getLogger(__name__)


class BankStatementChain(BaseChain):
    """
    ✅ PRODUCTION READY: Uses Gemini 2.0 Flash structured output
    LLM extracts data directly into Pydantic models - NO JSON PARSING!
    """

    def __init__(self):
        super().__init__(model_name="gemini-2.0-flash-exp", temperature=0.0)

    def _create_extraction_prompt(self) -> str:
        """Create prompt for structured extraction"""
        return """You are extracting bank statement data for loan application analysis.

Extract ALL information accurately:

1. **Account Details**: holder name, bank name, account number, account type
2. **Statement Period**: start and end dates (YYYY-MM-DD format)
3. **Balances**: opening and closing balance
4. **ALL Transactions**: Extract EVERY transaction from ALL pages with:
   - date (DD-MM-YYYY or DD/MM/YYYY format)
   - narration (exact description, don't summarize)
   - debit amount (0.0 if none)
   - credit amount (0.0 if none)
   - balance after transaction

CRITICAL RULES:
- Extract ALL transactions, don't skip any
- Keep narrations EXACTLY as shown
- Use 0.0 for missing amounts, never null
- Be thorough and accurate

The system will validate your response automatically."""

    def process(self, bank_statement_pdf: str, employer_name: str | None = None) -> BankStatementData:
        """
        Process bank statement PDF with structured output.

        Args:
            bank_statement_pdf: Path to bank statement PDF
            employer_name: Optional employer name for salary detection

        Returns:
            BankStatementData with deterministic metrics
        """
        logger.info(
            f"🏦 Processing bank statement: {Path(bank_statement_pdf).name}")

        # Convert PDF to images
        images = PDFProcessor.process_pdf_for_gemini(
            bank_statement_pdf, max_pages=Config.MAX_PDF_PAGES)
        logger.info(f"  ✅ Loaded {len(images)} pages")

        # Process in batches
        batch_size = 5
        batches: List[List[dict]] = []
        for i in range(0, len(images), batch_size):
            batches.append(images[i:i + batch_size])

        # Merged data
        all_transactions = []
        header_data = None
        extraction_notes = []

        prompt = self._create_extraction_prompt()

        # Process each batch with structured output
        for bi, batch in enumerate(batches, start=1):
            logger.info(
                f"  🤖 Extracting batch {bi}/{len(batches)} with structured output...")

            try:
                # Create multimodal content
                messages = self.create_gemini_content(prompt, batch)

                # ✅ Invoke with structured output (guaranteed valid Pydantic object!)
                extraction = self.invoke_structured_with_retry(
                    messages,
                    schema=BankStatementExtraction  # Pydantic schema
                )

                # Store header from first batch
                if bi == 1:
                    header_data = extraction

                # Accumulate transactions
                all_transactions.extend([t.model_dump()
                                        for t in extraction.transactions])
                extraction_notes.extend(extraction.extraction_notes)

                logger.info(
                    f"    ✅ Extracted {len(extraction.transactions)} transactions")

            except Exception as e:
                logger.error(f"  ❌ Batch {bi} extraction failed: {e}")
                extraction_notes.append(f"Batch {bi} failed: {str(e)}")
                continue

        logger.info(
            f"  ✅ Total transactions extracted: {len(all_transactions)}")

        # Compute deterministic metrics
        logger.info(f"  🧮 Computing bank metrics...")
        metrics = compute_bank_metrics(
            all_transactions, employer_name=employer_name)

        # Build final BankStatementData
        bank = BankStatementData(
            account_holder_name=header_data.account_holder_name if header_data else "Not Found",
            bank_name=header_data.bank_name if header_data else "Not Found",
            account_number=header_data.account_number if header_data else "Not Found",
            account_type=header_data.account_type if header_data else "Not Found",
            statement_period_start=header_data.statement_period_start if header_data else "1970-01-01",
            statement_period_end=header_data.statement_period_end if header_data else "1970-01-01",
            opening_balance=float(
                header_data.opening_balance if header_data else 0.0),
            closing_balance=float(
                header_data.closing_balance if header_data else 0.0),

            # ✅ Computed metrics (deterministic)
            average_monthly_balance=float(metrics["average_monthly_balance"]),
            minimum_balance=float(metrics["minimum_balance"]),
            salary_credits_detected=int(metrics["salary_credits_detected"]),
            average_monthly_salary=float(metrics["average_monthly_salary"]),
            salary_consistency_months=int(
                metrics["salary_consistency_months"]),
            last_salary_date=metrics["last_salary_date"],
            total_emi_debits=float(metrics["total_emi_debits"]),
            average_monthly_emi=float(metrics["average_monthly_emi"]),
            emi_transactions=metrics["emi_transactions"],
            unique_loan_accounts=int(metrics["unique_loan_accounts"]),
            total_credits=float(metrics["total_credits"]),
            total_debits=float(metrics["total_debits"]),
            credit_count=int(metrics["credit_count"]),
            debit_count=int(metrics["debit_count"]),
            average_monthly_spending=float(
                metrics["average_monthly_spending"]),

            # ✅ NEW: Bounce/Dishonor metrics
            bounce_count=int(metrics["bounce_count"]),
            dishonor_count=int(metrics["dishonor_count"]),
            insufficient_fund_incidents=int(
                metrics["insufficient_fund_incidents"]),

            # Transactions and metadata
            transactions=[BankTransaction(**t) for t in all_transactions],
            red_flags=[],
            positive_indicators=[],
            extraction_confidence=float(
                header_data.extraction_confidence if header_data else 0.0),
            extraction_notes=extraction_notes,
        )

        logger.info("  ✅ Bank statement processing complete")
        logger.info(f"  💰 Avg Monthly EMI: ₹{bank.average_monthly_emi:,.2f}")
        logger.info(
            f"  💵 Avg Monthly Salary: ₹{bank.average_monthly_salary:,.2f}")
        logger.info(f"  ⚠️ Bounce Count: {bank.bounce_count}")
        logger.info(f"  ⚠️ Dishonor Count: {bank.dishonor_count}")
        logger.info(
            f"  ⚠️ Insufficient Funds: {bank.insufficient_fund_incidents}")

        return bank
