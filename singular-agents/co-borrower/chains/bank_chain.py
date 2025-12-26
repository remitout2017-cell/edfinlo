"""
Bank Statement Chain - Extracts transactions via LLM, computes metrics deterministically
CORRECTED: Fixed JSON parsing regex
"""
from __future__ import annotations
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List

from chains.base_chain import BaseChain
from config import Config
from processors.pdf_processor import PDFProcessor
from schemas import BankStatementData, BankTransaction
from bank_metrics import compute_bank_metrics

logger = logging.getLogger(__name__)


class BankStatementChain(BaseChain):
    """
    LLM job: extract header + raw transaction rows.
    Python job: compute EMI/salary/avg balance precisely from those rows.
    """

    def __init__(self):
        super().__init__(model_name=Config.GEMINI_VISION_MODEL, temperature=0.0)

    def _prompt_transactions_only(self) -> str:
        return """You are extracting bank statement data for loan application analysis.

Return ONLY valid JSON with EXACT structure below. Do NOT add markdown fences or extra text.

{
  "account_holder_name": "string",
  "bank_name": "string",
  "account_number": "string",
  "account_type": "string",
  "statement_period_start": "YYYY-MM-DD",
  "statement_period_end": "YYYY-MM-DD",
  "opening_balance": 0.0,
  "closing_balance": 0.0,
  "transactions": [
    {
      "date": "DD-MM-YYYY or DD/MM/YYYY",
      "narration": "exact transaction description",
      "debit": 0.0,
      "credit": 0.0,
      "balance": 0.0
    }
  ],
  "extraction_confidence": 0.9,
  "extraction_notes": ["any observations"]
}

CRITICAL RULES:
- Extract ALL transactions from ALL pages provided
- If a field is empty/null, use 0.0 for numbers, "" for strings
- Keep narration exactly as shown (don't summarize)
- Date format: DD-MM-YYYY preferred
- Never output null values
- Return pure JSON only (no markdown fences)"""

    def _parse_json(self, text: str) -> Dict[str, Any]:
        """Parse JSON from LLM response with multiple fallback strategies - CORRECTED"""
        cleaned = (text or "").strip()

        # Strategy 1: direct parse
        try:
            return json.loads(cleaned)
        except Exception:
            pass

        # Strategy 2: remove fenced block if any - FIXED REGEX
        matches = re.findall(r"```json\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
        if matches:
            try:
                return json.loads(matches[0].strip())
            except Exception:
                pass

        # Strategy 2b: Try without json keyword
        matches = re.findall(r"```\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
        if matches:
            try:
                return json.loads(matches[0].strip())
            except Exception:
                pass

        # Strategy 3: find JSON boundaries
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and start < end:
            s = cleaned[start:end + 1]
            # Fix trailing commas
            s = re.sub(r",(\s*[}\]])", r"\1", s)
            try:
                return json.loads(s)
            except Exception as e:
                logger.warning(f"   ⚠️  JSON parse attempt failed: {e}")
                pass

        raise ValueError("Could not parse JSON from bank response")

    def process(self, bank_statement_pdf: str, employer_name: str | None = None) -> BankStatementData:
        """
        Process bank statement PDF and compute precise metrics.

        Args:
            bank_statement_pdf: Path to bank statement PDF
            employer_name: Optional employer name for better salary detection

        Returns:
            BankStatementData with deterministic metrics
        """
        logger.info(
            f"🏦 Processing bank statement: {Path(bank_statement_pdf).name}")

        # Convert PDF to images
        images = PDFProcessor.process_pdf_for_gemini(
            bank_statement_pdf, max_pages=Config.MAX_PDF_PAGES)
        logger.info(f"   ✅ Loaded {len(images)} pages")

        # Process in batches to manage API limits
        batches: List[List[Dict[str, Any]]] = []
        batch_size = 5
        for i in range(0, len(images), batch_size):
            batches.append(images[i:i + batch_size])

        # Merged data structure
        merged: Dict[str, Any] = {
            "account_holder_name": "",
            "bank_name": "",
            "account_number": "",
            "account_type": "",
            "statement_period_start": "",
            "statement_period_end": "",
            "opening_balance": 0.0,
            "closing_balance": 0.0,
            "transactions": [],
            "extraction_confidence": 0.0,
            "extraction_notes": [],
        }

        prompt = self._prompt_transactions_only()

        # Process each batch
        for bi, batch in enumerate(batches, start=1):
            logger.info(
                f"   🤖 Extracting transactions batch {bi}/{len(batches)}...")

            try:
                # Create proper multimodal content using BaseChain method
                messages = self.create_gemini_content(prompt, batch)

                # Invoke Gemini with retry logic
                resp = self.invoke_with_retry(messages)
                data = self._parse_json(resp.content)

                # Merge header fields (take first non-empty)
                for k in ("account_holder_name", "bank_name", "account_number", "account_type",
                          "statement_period_start", "statement_period_end"):
                    if not merged.get(k) and data.get(k):
                        merged[k] = data.get(k)

                # Balances: take first opening, last closing
                if merged.get("opening_balance", 0.0) == 0.0 and data.get("opening_balance") not in (None, 0, 0.0):
                    merged["opening_balance"] = data.get(
                        "opening_balance", 0.0)
                if data.get("closing_balance") not in (None, 0, 0.0):
                    merged["closing_balance"] = data.get(
                        "closing_balance", merged.get("closing_balance", 0.0))

                # Accumulate transactions
                txns = data.get("transactions") or []
                merged["transactions"].extend(txns)

                # Track confidence and notes
                merged["extraction_confidence"] = max(
                    float(merged.get("extraction_confidence") or 0.0),
                    float(data.get("extraction_confidence") or 0.0),
                )
                merged["extraction_notes"].extend(
                    data.get("extraction_notes") or [])

            except Exception as e:
                logger.error(f"   ❌ Batch {bi} extraction failed: {e}")
                merged["extraction_notes"].append(
                    f"Batch {bi} failed: {str(e)}")
                continue

        # Validate and coerce transactions to BankTransaction schema
        txn_objs = []
        for t in merged["transactions"]:
            try:
                txn_objs.append(BankTransaction(**t).model_dump())
            except Exception as e:
                logger.warning(f"   ⚠️  Skipping invalid transaction: {e}")
                continue

        logger.info(f"   ✅ Extracted {len(txn_objs)} valid transactions")

        # Compute deterministic metrics from transactions
        logger.info(f"   🧮 Computing deterministic bank metrics...")
        metrics = compute_bank_metrics(txn_objs, employer_name=employer_name)

        # Build final BankStatementData with computed metrics
        bank = BankStatementData(
            account_holder_name=merged["account_holder_name"] or "Not Found",
            bank_name=merged["bank_name"] or "Not Found",
            account_number=merged["account_number"] or "Not Found",
            account_type=merged["account_type"] or "Not Found",
            statement_period_start=merged["statement_period_start"] or "1970-01-01",
            statement_period_end=merged["statement_period_end"] or "1970-01-01",
            opening_balance=float(merged.get("opening_balance") or 0.0),
            closing_balance=float(merged.get("closing_balance") or 0.0),

            # Computed metrics (deterministic)
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

            # Keep raw transactions for audit trail
            transactions=[BankTransaction(**t) for t in txn_objs],

            # Placeholder fields (can be enhanced later)
            red_flags=[],
            positive_indicators=[],
            bounce_count=0,
            dishonor_count=0,
            insufficient_fund_incidents=0,

            extraction_confidence=float(
                merged.get("extraction_confidence") or 0.0),
            extraction_notes=merged.get("extraction_notes") or [],
        )

        logger.info("   ✅ Bank statement processing complete")
        logger.info(
            f"      💰 Avg Monthly EMI: ₹{bank.average_monthly_emi:,.2f}")
        logger.info(
            f"      💵 Avg Monthly Salary (detected): ₹{bank.average_monthly_salary:,.2f}")
        logger.info(
            f"      🏦 Avg Monthly Balance: ₹{bank.average_monthly_balance:,.2f}")

        return bank
