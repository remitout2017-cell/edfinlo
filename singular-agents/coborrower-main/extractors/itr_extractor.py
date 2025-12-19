"""
PRODUCTION-GRADE ITR Extractor
- Supports ITR-1, ITR-2, ITR-3, ITR-4 formats
- Multiple income source detection
- Assessment year validation
"""

import pdfplumber
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import statistics


class ITRExtractor:
    """
    Advanced ITR document extractor with format detection
    """

    # Income patterns for different ITR forms
    INCOME_PATTERNS = [
        # Primary income fields
        r'TOTAL\s*INCOME.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'GROSS\s*TOTAL\s*INCOME.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'INCOME\s*(?:CHARGEABLE|TAXABLE).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        # ITR form specific
        r'(?:5vi|5VI)\s*(?:TOTAL|INCOME).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',

        # Salary income
        r'INCOME\s*(?:FROM|UNDER)\s*(?:SALARIES|SALARY).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'SALARIES.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',

        # Business/Professional income
        r'(?:BUSINESS|PROFESSION).*?INCOME.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',

        # Other sources
        r'INCOME.*?OTHER\s*SOURCES.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
    ]

    # Assessment year patterns
    ASSESSMENT_YEAR_PATTERNS = [
        r'ASSESSMENT\s*YEAR.*?(\d{4}[-\s]?\d{2,4})',
        r'A\.?Y\.?\s*(\d{4}[-\s]?\d{2,4})',
        r'FOR\s*THE\s*YEAR.*?(\d{4}[-\s]?\d{2,4})',
    ]

    @staticmethod
    def extract(pdf_paths: List[str]) -> Dict:
        """
        Extract from multiple ITR documents
        """
        print(f"\n📊 Extracting {len(pdf_paths)} ITR documents...")

        incomes = []
        years = []
        valid_extractions = 0

        for i, pdf_path in enumerate(pdf_paths, 1):
            try:
                result = ITRExtractor._extract_single(pdf_path)

                if result['total_income'] > 0:
                    incomes.append(result['total_income'])
                    valid_extractions += 1

                    year_str = result.get('assessment_year', 'Unknown')
                    years.append(year_str)

                    print(
                        f"   ✅ ITR {i} ({year_str}): ₹{result['total_income']:,.2f} (Confidence: {result['confidence']:.0%})")
                else:
                    print(f"   ⚠️  ITR {i}: Could not extract income")

            except Exception as e:
                print(f"   ❌ ITR {i}: Error - {e}")
                continue

        if not incomes:
            print("   ⚠️  No valid ITR data extracted")
            return {
                "avg_annual_income": 0.0,
                "years": 0,
                "assessment_years": [],
                "confidence": 0.0
            }

        # Calculate statistics
        avg_income = statistics.mean(incomes)

        # Check for income growth trend
        if len(incomes) > 1:
            growth_rate = (incomes[-1] - incomes[0]) / \
                incomes[0] if incomes[0] > 0 else 0
            growth_trend = "growing" if growth_rate > 0.05 else "stable" if growth_rate > - \
                0.05 else "declining"
        else:
            growth_trend = "insufficient_data"

        confidence = valid_extractions / len(pdf_paths)

        print(f"   📈 Average Annual Income: ₹{avg_income:,.2f}")
        print(f"   📅 Years covered: {len(incomes)} | Trend: {growth_trend}")

        return {
            "avg_annual_income": round(avg_income, 2),
            "years": len(incomes),
            "assessment_years": years,
            "income_trend": growth_trend,
            "confidence": round(confidence, 2)
        }

    @staticmethod
    def _extract_single(pdf_path: str) -> Dict:
        """
        Extract from single ITR document
        """
        with pdfplumber.open(pdf_path) as pdf:
            # Focus on first 5 pages (income details usually here)
            relevant_pages = pdf.pages[:5]
            full_text = '\n'.join(page.extract_text()
                                  or '' for page in relevant_pages)

            # Extract income
            total_income = ITRExtractor._find_income(full_text)

            # Extract assessment year
            assessment_year = ITRExtractor._find_assessment_year(full_text)

            # Try table extraction as backup
            if total_income == 0:
                total_income = ITRExtractor._extract_from_tables(
                    relevant_pages)

            # Calculate confidence
            confidence = 1.0 if total_income > 100000 else 0.5 if total_income > 0 else 0.0

            return {
                'total_income': round(total_income, 2),
                'assessment_year': assessment_year,
                'confidence': confidence
            }

    @staticmethod
    def _find_income(text: str) -> float:
        """
        Find total income from text using multiple patterns
        """
        text_upper = text.upper()
        candidates = []

        for pattern in ITRExtractor.INCOME_PATTERNS:
            matches = re.finditer(pattern, text_upper,
                                  re.IGNORECASE | re.MULTILINE)
            for match in matches:
                amount = ITRExtractor._parse_amount(match.group(1))
                # Reasonable annual income range (1L to 10Cr)
                if 100000 <= amount <= 100000000:
                    candidates.append(amount)

        if not candidates:
            return 0.0

        # Return the highest reasonable value (usually total income)
        # But filter out extreme outliers
        if len(candidates) == 1:
            return candidates[0]

        # Use median to avoid outliers
        return statistics.median(candidates)

    @staticmethod
    def _find_assessment_year(text: str) -> str:
        """
        Extract assessment year
        """
        for pattern in ITRExtractor.ASSESSMENT_YEAR_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                year_str = match.group(1)
                # Normalize format
                year_str = year_str.replace(' ', '-')
                return year_str

        return "Unknown"

    @staticmethod
    def _extract_from_tables(pages) -> float:
        """
        Extract income from table structures (backup method)
        """
        for page in pages:
            tables = page.extract_tables()

            for table in tables:
                if not table:
                    continue

                for row in table:
                    if not row or len(row) < 2:
                        continue

                    row_text = ' '.join(str(cell) for cell in row).upper()

                    # Look for income rows
                    if any(kw in row_text for kw in ['TOTAL INCOME', 'GROSS TOTAL', 'TAXABLE INCOME']):
                        for cell in row:
                            amount = ITRExtractor._parse_amount(str(cell))
                            if 100000 <= amount <= 100000000:
                                return amount

        return 0.0

    @staticmethod
    def _parse_amount(value: str) -> float:
        """Parse amount from string"""
        if not value:
            return 0.0

        # Remove currency symbols, commas, spaces
        cleaned = re.sub(r'[₹$,\s]', '', str(value))

        # Extract number
        match = re.search(r'[\d.]+', cleaned)
        if match:
            try:
                return float(match.group())
            except ValueError:
                return 0.0

        return 0.0
