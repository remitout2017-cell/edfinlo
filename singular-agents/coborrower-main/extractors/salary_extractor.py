"""
PRODUCTION-GRADE Salary Slip Extractor
- Multi-format support (different company templates)
- Table and text extraction
- Validation and cross-checking
"""

import pdfplumber
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import statistics


class SalaryExtractor:
    """
    Advanced salary slip extractor with validation
    """
    
    # Comprehensive patterns for different salary components
    GROSS_PATTERNS = [
        r'GROSS\s*(?:SALARY|PAY|EARNINGS?).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'TOTAL\s*EARNINGS?.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'GROSS\s*AMOUNT.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
    ]
    
    NET_PATTERNS = [
        r'NET\s*(?:SALARY|PAY|AMOUNT).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'TAKE\s*HOME.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'(?:AMOUNT\s*)?PAYABLE.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'NET\s*AMOUNT.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'TOTAL\s*NET.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
    ]
    
    DEDUCTION_PATTERNS = [
        r'TOTAL\s*DEDUCTIONS?.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        r'DEDUCTIONS?.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
    ]
    
    BASIC_PATTERNS = [
        r'BASIC\s*(?:SALARY|PAY).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
    ]
    
    @staticmethod
    def extract(pdf_paths: List[str]) -> Dict:
        """
        Extract from multiple salary slips and validate
        """
        print(f"\n💼 Extracting {len(pdf_paths)} salary slips...")
        
        salaries = []
        gross_salaries = []
        deductions_list = []
        valid_extractions = 0
        
        for i, pdf_path in enumerate(pdf_paths, 1):
            try:
                result = SalaryExtractor._extract_single(pdf_path)
                
                if result['net_pay'] > 0:
                    salaries.append(result['net_pay'])
                    valid_extractions += 1
                    print(f"   ✅ Slip {i}: ₹{result['net_pay']:,.2f} (Confidence: {result['confidence']:.0%})")
                    
                    if result['gross_pay'] > 0:
                        gross_salaries.append(result['gross_pay'])
                    
                    if result['deductions'] > 0:
                        deductions_list.append(result['deductions'])
                else:
                    print(f"   ⚠️  Slip {i}: Could not extract salary")
                    
            except Exception as e:
                print(f"   ❌ Slip {i}: Error - {e}")
                continue
        
        if not salaries:
            print("   ⚠️  No valid salary data extracted")
            return {
                "avg_monthly_net": 0.0,
                "avg_monthly_gross": 0.0,
                "avg_deductions": 0.0,
                "count": 0,
                "confidence": 0.0
            }
        
        # Calculate statistics
        avg_net = statistics.mean(salaries)
        avg_gross = statistics.mean(gross_salaries) if gross_salaries else 0.0
        avg_deductions = statistics.mean(deductions_list) if deductions_list else 0.0
        
        # Validate consistency
        if len(salaries) > 1:
            std_dev = statistics.stdev(salaries)
            cv = std_dev / avg_net  # Coefficient of variation
            consistency = 1.0 - min(cv, 1.0)  # Higher is better
        else:
            consistency = 0.7  # Single slip has moderate confidence
        
        confidence = min(1.0, (valid_extractions / len(pdf_paths)) * consistency)
        
        print(f"   📊 Average Net: ₹{avg_net:,.2f} | Confidence: {confidence:.0%}")
        
        return {
            "avg_monthly_net": round(avg_net, 2),
            "avg_monthly_gross": round(avg_gross, 2),
            "avg_deductions": round(avg_deductions, 2),
            "count": len(salaries),
            "confidence": round(confidence, 2)
        }
    
    @staticmethod
    def _extract_single(pdf_path: str) -> Dict:
        """
        Extract from single salary slip
        Uses multiple strategies and cross-validates
        """
        with pdfplumber.open(pdf_path) as pdf:
            # Combine text from all pages (salary slips usually 1-2 pages)
            full_text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
            
            # Strategy 1: Try table extraction first
            table_result = SalaryExtractor._extract_from_tables(pdf)
            
            # Strategy 2: Text pattern matching
            text_result = SalaryExtractor._extract_from_text(full_text)
            
            # Cross-validate and choose best result
            if table_result['confidence'] > text_result['confidence']:
                return table_result
            else:
                return text_result
    
    @staticmethod
    def _extract_from_tables(pdf) -> Dict:
        """
        Extract from table structure
        """
        gross_pay = 0.0
        net_pay = 0.0
        deductions = 0.0
        
        for page in pdf.pages:
            tables = page.extract_tables()
            
            for table in tables:
                if not table:
                    continue
                
                for row in table:
                    if not row or len(row) < 2:
                        continue
                    
                    row_text = ' '.join(str(cell) for cell in row).upper()
                    
                    # Look for net pay
                    if any(kw in row_text for kw in ['NET PAY', 'NET SALARY', 'TAKE HOME', 'PAYABLE']):
                        for cell in row:
                            amount = SalaryExtractor._parse_amount(str(cell))
                            if amount > 1000:
                                net_pay = max(net_pay, amount)
                    
                    # Look for gross pay
                    elif any(kw in row_text for kw in ['GROSS', 'TOTAL EARNINGS']):
                        for cell in row:
                            amount = SalaryExtractor._parse_amount(str(cell))
                            if amount > 1000:
                                gross_pay = max(gross_pay, amount)
                    
                    # Look for deductions
                    elif any(kw in row_text for kw in ['TOTAL DEDUCTION', 'DEDUCTIONS']):
                        for cell in row:
                            amount = SalaryExtractor._parse_amount(str(cell))
                            if amount > 0:
                                deductions = max(deductions, amount)
        
        # Validate: Gross - Deductions should approximately equal Net
        if gross_pay > 0 and deductions > 0:
            calculated_net = gross_pay - deductions
            if net_pay == 0:
                net_pay = calculated_net
            elif abs(net_pay - calculated_net) / net_pay > 0.1:  # >10% difference
                # Use calculated value if discrepancy
                net_pay = calculated_net
        
        confidence = SalaryExtractor._calculate_confidence(net_pay, gross_pay, deductions)
        
        return {
            'net_pay': round(net_pay, 2),
            'gross_pay': round(gross_pay, 2),
            'deductions': round(deductions, 2),
            'confidence': confidence
        }
    
    @staticmethod
    def _extract_from_text(text: str) -> Dict:
        """
        Extract from raw text using patterns
        """
        # Extract net salary
        net_pay = SalaryExtractor._find_value(text, SalaryExtractor.NET_PATTERNS)
        
        # Extract gross salary
        gross_pay = SalaryExtractor._find_value(text, SalaryExtractor.GROSS_PATTERNS)
        
        # Extract deductions
        deductions = SalaryExtractor._find_value(text, SalaryExtractor.DEDUCTION_PATTERNS)
        
        # Validate and cross-check
        if gross_pay > 0 and deductions > 0 and net_pay == 0:
            net_pay = gross_pay - deductions
        elif net_pay > 0 and gross_pay > 0 and deductions == 0:
            deductions = gross_pay - net_pay
        
        confidence = SalaryExtractor._calculate_confidence(net_pay, gross_pay, deductions)
        
        return {
            'net_pay': round(net_pay, 2),
            'gross_pay': round(gross_pay, 2),
            'deductions': round(deductions, 2),
            'confidence': confidence
        }
    
    # ========== HELPER METHODS ==========
    
    @staticmethod
    def _find_value(text: str, patterns: List[str]) -> float:
        """Find value using regex patterns"""
        text_upper = text.upper()
        
        for pattern in patterns:
            matches = re.finditer(pattern, text_upper, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                amount = SalaryExtractor._parse_amount(match.group(1))
                if amount > 1000:  # Reasonable salary threshold
                    return amount
        
        return 0.0
    
    @staticmethod
    def _parse_amount(value: str) -> float:
        """Parse amount from string"""
        if not value:
            return 0.0
        
        # Remove currency symbols, commas, spaces
        cleaned = re.sub(r'[₹$,\s]', '', str(value))
        
        # Extract first number found
        match = re.search(r'[\d.]+', cleaned)
        if match:
            try:
                return float(match.group())
            except ValueError:
                return 0.0
        
        return 0.0
    
    @staticmethod
    def _calculate_confidence(net_pay: float, gross_pay: float, deductions: float) -> float:
        """
        Calculate extraction confidence
        """
        score = 0.0
        
        # Net pay found (most important)
        if net_pay > 10000:
            score += 0.6
        elif net_pay > 0:
            score += 0.3
        
        # Gross pay found
        if gross_pay > 0:
            score += 0.2
        
        # Deductions found
        if deductions > 0:
            score += 0.1
        
        # Validation: check if Gross - Deductions ≈ Net
        if all([net_pay > 0, gross_pay > 0, deductions > 0]):
            calculated_net = gross_pay - deductions
            error_ratio = abs(net_pay - calculated_net) / net_pay
            if error_ratio < 0.05:  # <5% error
                score += 0.1
        
        return min(1.0, score)