"""Bank Statement Extraction Chain - production hardened.

Hardening:
- Accepts Gemini returning null for numeric fields.
- Coerces missing/null numerics to 0 before Pydantic validation.
- Never throws from _parse_response; it raises only after all strategies are exhausted.
"""

from __future__ import annotations

from typing import Any, Dict
import logging
from pathlib import Path
import json
import re

from chains.base_chain import BaseChain
from schemas import BankStatementData
from processors.pdf_processor import PDFProcessor
from config import Config

logger = logging.getLogger(__name__)


class BankStatementChain(BaseChain):
    def __init__(self):
        super().__init__(model_name=Config.GEMINI_VISION_MODEL)

    def create_extraction_prompt(self) -> str:
        return """EXTRACT ALL DATA FROM BANK STATEMENT FOR LOAN APPLICATION.

CRITICAL:
- Return ONLY valid JSON.
- Do NOT output null for numeric fields. If unknown, output 0.
- Dates must be YYYY-MM-DD.

JSON schema (fill every field):
{
  "account_holder_name": "string",
  "bank_name": "string",
  "account_number": "string",
  "account_type": "string",
  "statement_period_start": "YYYY-MM-DD",
  "statement_period_end": "YYYY-MM-DD",
  "opening_balance": 0.0,
  "closing_balance": 0.0,
  "average_monthly_balance": 0.0,
  "minimum_balance": 0.0,
  "salary_credits_detected": 0,
  "average_monthly_salary": 0.0,
  "salary_consistency_months": 0,
  "last_salary_date": null,
  "total_emi_debits": 0.0,
  "average_monthly_emi": 0.0,
  "emi_transactions": [],
  "unique_loan_accounts": 0,
  "bounce_count": 0,
  "dishonor_count": 0,
  "insufficient_fund_incidents": 0,
  "total_credits": 0.0,
  "total_debits": 0.0,
  "credit_count": 0,
  "debit_count": 0,
  "average_monthly_spending": 0.0,
  "high_value_transactions": [],
  "red_flags": [],
  "positive_indicators": [],
  "extraction_confidence": 0.0,
  "extraction_notes": []
}
"""

    def process(self, bank_statement_pdf: str) -> BankStatementData:
        logger.info(
            f"🏦 Processing bank statement: {Path(bank_statement_pdf).name}")

        try:
            images = PDFProcessor.process_pdf_for_gemini(
                bank_statement_pdf, max_pages=30)
            logger.info(f"   ✅ Loaded {len(images)} pages")

            prompt = self.create_extraction_prompt()
            messages = self.create_gemini_content(prompt, images)

            logger.info("   🤖 Analyzing bank statement with Gemini...")
            response = self.llm.invoke(messages)

            logger.info("   📝 Parsing structured output...")
            parsed = self._parse_response(response.content)

            logger.info("   ✅ Bank statement extraction complete!")
            logger.info(
                f"      Average Monthly Balance: ₹{parsed.average_monthly_balance:,.2f}")
            logger.info(
                f"      Average Monthly EMI: ₹{parsed.average_monthly_emi:,.2f}")
            logger.info(f"      Bounce Count: {parsed.bounce_count}")
            logger.info(
                f"      Confidence: {parsed.extraction_confidence:.0%}")
            return parsed

        except Exception as e:
            logger.error(f"   ❌ Bank statement extraction failed: {e}")
            logger.exception("Full traceback:")
            return BankStatementData(
                account_holder_name="Extraction Failed",
                bank_name="Unknown",
                account_number="Unknown",
                account_type="Unknown",
                statement_period_start="1970-01-01",
                statement_period_end="1970-01-01",
                extraction_confidence=0.0,
                extraction_notes=[f"Error: {str(e)}"],
            )

    def _coerce_nulls(self, data: Dict[str, Any]) -> Dict[str, Any]:
        float_fields = [
            "opening_balance", "closing_balance", "average_monthly_balance", "minimum_balance",
            "average_monthly_salary", "total_emi_debits", "average_monthly_emi",
            "total_credits", "total_debits", "average_monthly_spending",
            "extraction_confidence",
        ]
        int_fields = [
            "salary_credits_detected", "salary_consistency_months", "unique_loan_accounts",
            "bounce_count", "dishonor_count", "insufficient_fund_incidents",
            "credit_count", "debit_count",
        ]
        for k in float_fields:
            if data.get(k) is None:
                data[k] = 0.0
        for k in int_fields:
            if data.get(k) is None:
                data[k] = 0

        for k in ("emi_transactions", "high_value_transactions"):
            if data.get(k) is None:
                data[k] = []
        for k in ("red_flags", "positive_indicators", "extraction_notes"):
            if data.get(k) is None:
                data[k] = []
        return data

    def _parse_response(self, response_text: str) -> BankStatementData:
        cleaned = (response_text or "").strip()

        def try_build(json_obj: Dict[str, Any]) -> BankStatementData:
            json_obj = self._coerce_nulls(json_obj)
            return BankStatementData(**json_obj)

        # Strategy 1: Direct JSON
        try:
            obj = json.loads(cleaned)
            logger.info("      ✅ Direct JSON parse succeeded")
            return try_build(obj)
        except Exception:
            pass

        # Strategy 2: Markdown fenced block
        if "```" in cleaned:
            matches = re.findall(
                r"```(?:json)?\s*(.*?)\s*```", cleaned, re.DOTALL)
            if matches:
                try:
                    obj = json.loads(matches[0].strip())
                    logger.info("      ✅ Markdown extraction succeeded")
                    return try_build(obj)
                except Exception:
                    pass

        # Strategy 3: JSON boundary extraction
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and start < end:
            json_str = cleaned[start:end+1]
            json_str = re.sub(r",(\s*[}\]])", r"\1", json_str)
            try:
                obj = json.loads(json_str)
                logger.info("      ✅ Boundary extraction succeeded")
                return try_build(obj)
            except Exception as e:
                logger.error(f"      ❌ Boundary parse error: {e}")
                logger.error(f"      📝 JSON: {json_str[:800]}...")

        logger.error("      ❌ All parsing strategies failed")
        logger.error(f"      📝 Full response: {cleaned[:1200]}")
        raise ValueError("Could not parse JSON from response")
