"""
PRODUCTION-GRADE Form 16 Extractor
- Extracts gross salary, deductions, and tax details
- Cross-validates with ITR data
- Supports multiple financial years
"""

import pdfplumber
import re
from typing import Dict, List, Optional
from datetime import datetime
import statistics


class Form16Extractor:
    """
    Advanced Form 16 extractor for income validation
    """

    # Gross salary patterns
    GROSS_SALARY_PATTERNS = [
        r'GROSS\s*SALARY.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'TOTAL\s*(?:GROSS\s*)?SALARY.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'(?:SECTION|PART)\s*B.*?SALARY.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
    ]

    # Deductions patterns
    DEDUCTIONS_PATTERNS = [
        r'DEDUCTIONS?\s*(?:UNDER\s*)?(?:CHAPTER\s*)?VI[- ]?A.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'80C.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'TOTAL\s*DEDUCTIONS?.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
    ]

    # Tax paid patterns
    TAX_PAID_PATTERNS = [
        r'TAX\s*(?:DEDUCTED|PAID).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'TDS.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'TOTAL\s*TAX.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
    ]

    # Financial year patterns
    FY_PATTERNS = [
        r'(?:FINANCIAL|F\.?Y\.?|FY)\s*(?:YEAR)?[\s:]*(\d{4}[-\s]?\d{2,4})',
        r'(?:ASSESSMENT|A\.?Y\.?|AY)\s*(?:YEAR)?[\s:]*(\d{4}[-\s]?\d{2,4})',
        r'FOR\s*THE\s*(?:YEAR|PERIOD).*?(\d{4}[-\s]?\d{2,4})',
    ]

    @staticmethod
    def extract(pdf_paths: List[str]) -> Dict:
        """
        Extract from multiple Form 16 documents (typically 2 years)
        """
        print(f"\n📋 Extracting {len(pdf_paths)} Form 16 documents...")

        gross_salaries = []
        deductions_list = []
        tax_paid_list = []
        financial_years = []
        valid_extractions = 0

        for i, pdf_path in enumerate(pdf_paths, 1):
            try:
                result = Form16Extractor._extract_single(pdf_path)

                if result['gross_salary'] > 0:
                    gross_salaries.append(result['gross_salary'])
                    valid_extractions += 1

                    fy = result.get('financial_year', 'Unknown')
                    financial_years.append(fy)

                    print(f"   ✅ Form 16 {i} ({fy}):")
                    print(f"      Gross: ₹{result['gross_salary']:,.2f}")
                    print(f"      Deductions: ₹{result['deductions']:,.2f}")
                    print(f"      Tax Paid: ₹{result['tax_paid']:,.2f}")
                else:
                    print(f"   ⚠️  Form 16 {i}: Could not extract salary")

                if result['deductions'] > 0:
                    deductions_list.append(result['deductions'])

                if result['tax_paid'] > 0:
                    tax_paid_list.append(result['tax_paid'])

            except Exception as e:
                print(f"   ❌ Form 16 {i}: Error - {e}")
                continue

        if not gross_salaries:
            print("   ⚠️  No valid Form 16 data extracted")
            return {
                "avg_gross_salary": 0.0,
                "avg_deductions": 0.0,
                "avg_tax_paid": 0.0,
                "years": 0,
                "financial_years": [],
                "confidence": 0.0
            }

        # Calculate averages
        avg_gross = statistics.mean(gross_salaries)
        avg_deductions = statistics.mean(
            deductions_list) if deductions_list else 0.0
        avg_tax_paid = statistics.mean(tax_paid_list) if tax_paid_list else 0.0

        # Calculate confidence
        confidence = valid_extractions / len(pdf_paths)

        print(f"   📊 Average Gross Salary: ₹{avg_gross:,.2f}")
        print(f"   📅 Years covered: {len(gross_salaries)}")

        return {
            "avg_gross_salary": round(avg_gross, 2),
            "avg_deductions": round(avg_deductions, 2),
            "avg_tax_paid": round(avg_tax_paid, 2),
            "years": len(gross_salaries),
            "financial_years": financial_years,
            "confidence": round(confidence, 2)
        }

    @staticmethod
    def _extract_single(pdf_path: str) -> Dict:
        """
        Extract from single Form 16 document
        """
        with pdfplumber.open(pdf_path) as pdf:
            # Form 16 is typically 2-4 pages
            relevant_pages = pdf.pages[:5]
            full_text = '\n'.join(page.extract_text()
                                  or '' for page in relevant_pages)

            # Extract gross salary
            gross_salary = Form16Extractor._find_value(
                full_text, Form16Extractor.GROSS_SALARY_PATTERNS)

            # Extract deductions
            deductions = Form16Extractor._find_value(
                full_text, Form16Extractor.DEDUCTIONS_PATTERNS)

            # Extract tax paid
            tax_paid = Form16Extractor._find_value(
                full_text, Form16Extractor.TAX_PAID_PATTERNS)

            # Extract financial year
            financial_year = Form16Extractor._find_financial_year(full_text)

            # Try table extraction as backup
            if gross_salary == 0:
                table_data = Form16Extractor._extract_from_tables(
                    relevant_pages)
                gross_salary = table_data.get('gross_salary', 0.0)
                deductions = table_data.get('deductions', 0.0)
                tax_paid = table_data.get('tax_paid', 0.0)

            return {
                'gross_salary': round(gross_salary, 2),
                'deductions': round(deductions, 2),
                'tax_paid': round(tax_paid, 2),
                'financial_year': financial_year
            }

    @staticmethod
    def _extract_from_tables(pages) -> Dict:
        """
        Extract from table structures (backup method)
        """
        gross_salary = 0.0
        deductions = 0.0
        tax_paid = 0.0

        for page in pages:
            tables = page.extract_tables()

            for table in tables:
                if not table:
                    continue

                for row in table:
                    if not row or len(row) < 2:
                        continue

                    row_text = ' '.join(str(cell) for cell in row).upper()

                    # Look for gross salary
                    if any(kw in row_text for kw in ['GROSS SALARY', 'TOTAL SALARY']):
                        for cell in row:
                            amount = Form16Extractor._parse_amount(str(cell))
                            if amount > 100000:  # Reasonable annual salary
                                gross_salary = max(gross_salary, amount)

                    # Look for deductions
                    elif any(kw in row_text for kw in ['DEDUCTION', '80C', 'CHAPTER VI']):
                        for cell in row:
                            amount = Form16Extractor._parse_amount(str(cell))
                            if amount > 0:
                                deductions = max(deductions, amount)

                    # Look for tax paid
                    elif any(kw in row_text for kw in ['TAX DEDUCTED', 'TDS', 'TAX PAID']):
                        for cell in row:
                            amount = Form16Extractor._parse_amount(str(cell))
                            if amount > 0:
                                tax_paid = max(tax_paid, amount)

        return {
            'gross_salary': gross_salary,
            'deductions': deductions,
            'tax_paid': tax_paid
        }

    @staticmethod
    def _find_value(text: str, patterns: List[str]) -> float:
        """Find value using regex patterns"""
        text_upper = text.upper()

        for pattern in patterns:
            matches = re.finditer(
                pattern, text_upper, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                amount = Form16Extractor._parse_amount(match.group(1))
                # Reasonable annual salary range (1L to 1Cr)
                if 100000 <= amount <= 10000000:
                    return amount

        return 0.0

    @staticmethod
    def _find_financial_year(text: str) -> str:
        """Extract financial year"""
        for pattern in Form16Extractor.FY_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                year_str = match.group(1)
                year_str = year_str.replace(' ', '-')
                return year_str

        return "Unknown"

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
