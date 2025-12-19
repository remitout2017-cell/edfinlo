"""
PRODUCTION-GRADE Bank Statement Extractor
- Multi-strategy parsing with confidence scoring
- Table extraction support for structured statements
- Fallback text parsing for unstructured statements
- Transaction categorization with pattern matching
"""

import pdfplumber
import re
from typing import Dict, List, Tuple, Optional
from datetime import datetime
from collections import defaultdict
import statistics


class BankExtractor:
    """
    Advanced bank statement extractor with multiple strategies
    """
    
    # Enhanced patterns with more coverage
    SALARY_PATTERNS = [
        r'SAL(?:ARY)?(?!\s*ACCOUNT)',  # Salary but not "SALARY ACCOUNT"
        r'(?:NEFT|RTGS|IMPS|UPI).*SAL',
        r'CREDIT.*(?:SALARY|WAGES)',
        r'PAY.*?ROLL',
        r'MONTHLY.*PAY',
        r'EMPLOYER.*CREDIT',
        r'WAGES?\b',
        r'STIPEND',
        r'REMUNERATION',
    ]
    
    EMI_PATTERNS = [
        r'\bEMI\b',
        r'LOAN.*(?:REPAY|PAYMENT|INST)',
        r'(?:HDFC|ICICI|SBI|AXIS|KOTAK|YES|IDFC|INDUSIND).*LOAN',
        r'HOME.*LOAN',
        r'PERSONAL.*LOAN',
        r'CAR.*LOAN',
        r'VEHICLE.*LOAN',
        r'BAJAJ.*FIN',
        r'TATA.*(?:CAPITAL|FINANCE)',
        r'CREDIT.*CARD.*(?:PAYMENT|PAY)',
        r'CC.*(?:PAYMENT|PAY)\b',
        r'FINANCE.*EMI',
        r'(?:HFDC|ICICI|SBI).*CC',
    ]
    
    BOUNCE_PATTERNS = [
        r'BOUNCE',
        r'RETURN.*(?:UNPAID|INSUFFI?CIENT)',
        r'DISHONO?UR',
        r'INSUFFI?CIENT.*FUND',
        r'PAYMENT.*FAILED',
        r'CHEQUE.*RETURN',
        r'INSUFFICIENT.*BALANCE',
        r'ECS.*(?:BOUNCE|RETURN)',
    ]
    
    # Date patterns for transaction parsing
    DATE_PATTERNS = [
        r'\b(\d{2}[-/]\d{2}[-/]\d{4})\b',  # DD-MM-YYYY or DD/MM/YYYY
        r'\b(\d{2}[-/]\d{2}[-/]\d{2})\b',  # DD-MM-YY
        r'\b(\d{4}[-/]\d{2}[-/]\d{2})\b',  # YYYY-MM-DD
    ]
    
    @staticmethod
    def extract(pdf_path: str) -> Dict:
        """
        Main extraction method with multi-strategy approach
        """
        print(f"\n🏦 Extracting bank statement: {pdf_path}")
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                # Try table extraction first (more accurate)
                table_result = BankExtractor._extract_from_tables(pdf)
                
                # If table extraction insufficient, fallback to text
                if table_result['confidence'] < 0.5:
                    print("   ⚠️  Table extraction low confidence, trying text parsing...")
                    text_result = BankExtractor._extract_from_text(pdf)
                    
                    # Use better result
                    if text_result['confidence'] > table_result['confidence']:
                        return text_result
                
                return table_result
                
        except Exception as e:
            print(f"   ❌ Bank extraction error: {e}")
            return {
                "avg_monthly_salary": 0.0,
                "avg_monthly_emi": 0.0,
                "total_emi_6months": 0.0,
                "bounce_count": 0,
                "salary_months": 0,
                "confidence": 0.0,
                "error": str(e)
            }
    
    @staticmethod
    def _extract_from_tables(pdf) -> Dict:
        """
        Strategy 1: Extract from table structures
        Best for well-formatted bank statements
        """
        monthly_salaries = []
        monthly_emis = []
        bounce_count = 0
        transactions = []
        
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            
            if not tables:
                continue
            
            for table in tables:
                if not table or len(table) < 2:
                    continue
                
                # Try to identify columns
                header = table[0] if table else []
                
                # Find relevant column indices
                date_col = BankExtractor._find_column(header, ['DATE', 'TXN DATE', 'TRANSACTION DATE'])
                desc_col = BankExtractor._find_column(header, ['DESCRIPTION', 'PARTICULARS', 'NARRATION', 'DETAILS'])
                debit_col = BankExtractor._find_column(header, ['DEBIT', 'WITHDRAWAL', 'DR', 'WITHDRAWALS'])
                credit_col = BankExtractor._find_column(header, ['CREDIT', 'DEPOSIT', 'CR', 'DEPOSITS'])
                
                # Process rows
                for row in table[1:]:
                    if not row or len(row) < 2:
                        continue
                    
                    try:
                        desc = str(row[desc_col] if desc_col is not None else '')
                        credit = BankExtractor._parse_amount(row[credit_col] if credit_col is not None else '')
                        debit = BankExtractor._parse_amount(row[debit_col] if debit_col is not None else '')
                        
                        # Categorize transaction
                        if BankExtractor._is_salary(desc) and credit > 10000:
                            monthly_salaries.append(credit)
                            transactions.append(('salary', credit))
                        
                        elif BankExtractor._is_emi(desc) and debit > 0:
                            monthly_emis.append(debit)
                            transactions.append(('emi', debit))
                        
                        elif BankExtractor._is_bounce(desc):
                            bounce_count += 1
                            transactions.append(('bounce', 0))
                            
                    except (IndexError, ValueError) as e:
                        continue
        
        # Calculate aggregates
        avg_salary = statistics.mean(monthly_salaries) if monthly_salaries else 0.0
        total_emi = sum(monthly_emis)
        avg_emi = total_emi / 6 if total_emi > 0 else 0.0
        
        # Calculate confidence score
        confidence = BankExtractor._calculate_confidence(
            salary_count=len(monthly_salaries),
            emi_count=len(monthly_emis),
            total_txns=len(transactions)
        )
        
        return {
            "avg_monthly_salary": round(avg_salary, 2),
            "avg_monthly_emi": round(avg_emi, 2),
            "total_emi_6months": round(total_emi, 2),
            "bounce_count": bounce_count,
            "salary_months": len(monthly_salaries),
            "confidence": confidence
        }
    
    @staticmethod
    def _extract_from_text(pdf) -> Dict:
        """
        Strategy 2: Extract from raw text
        Fallback for poorly formatted statements
        """
        monthly_salaries = []
        monthly_emis = []
        bounce_count = 0
        
        for page in pdf.pages:
            text = page.extract_text() or ''
            lines = text.split('\n')
            
            for line in lines:
                # Skip headers
                if any(h in line.upper() for h in ['DATE', 'PARTICULARS', 'OPENING BALANCE', 'CLOSING BALANCE']):
                    continue
                
                line_upper = line.upper()
                
                # Check for salary
                if BankExtractor._is_salary(line):
                    amount = BankExtractor._extract_credit_amount(line)
                    if amount > 10000:  # Reasonable salary threshold
                        monthly_salaries.append(amount)
                
                # Check for EMI
                elif BankExtractor._is_emi(line):
                    amount = BankExtractor._extract_debit_amount(line)
                    if amount > 500:  # Minimum EMI threshold
                        monthly_emis.append(amount)
                
                # Check for bounce
                elif BankExtractor._is_bounce(line):
                    bounce_count += 1
        
        # Aggregate
        avg_salary = statistics.mean(monthly_salaries) if monthly_salaries else 0.0
        total_emi = sum(monthly_emis)
        avg_emi = total_emi / 6 if total_emi > 0 else 0.0
        
        confidence = BankExtractor._calculate_confidence(
            salary_count=len(monthly_salaries),
            emi_count=len(monthly_emis),
            total_txns=len(monthly_salaries) + len(monthly_emis)
        )
        
        return {
            "avg_monthly_salary": round(avg_salary, 2),
            "avg_monthly_emi": round(avg_emi, 2),
            "total_emi_6months": round(total_emi, 2),
            "bounce_count": bounce_count,
            "salary_months": len(monthly_salaries),
            "confidence": confidence
        }
    
    # ========== HELPER METHODS ==========
    
    @staticmethod
    def _find_column(header: List, keywords: List[str]) -> Optional[int]:
        """Find column index by keywords"""
        for i, cell in enumerate(header):
            if not cell:
                continue
            cell_upper = str(cell).upper()
            for keyword in keywords:
                if keyword in cell_upper:
                    return i
        return None
    
    @staticmethod
    def _parse_amount(value: str) -> float:
        """Parse amount from string"""
        if not value:
            return 0.0
        
        # Remove currency symbols and commas
        cleaned = re.sub(r'[₹$,\s]', '', str(value))
        
        # Extract number
        match = re.search(r'[\d.]+', cleaned)
        if match:
            try:
                return float(match.group())
            except ValueError:
                return 0.0
        return 0.0
    
    @staticmethod
    def _is_salary(text: str) -> bool:
        """Check if transaction is salary"""
        text_upper = str(text).upper()
        return any(re.search(pattern, text_upper) for pattern in BankExtractor.SALARY_PATTERNS)
    
    @staticmethod
    def _is_emi(text: str) -> bool:
        """Check if transaction is EMI"""
        text_upper = str(text).upper()
        return any(re.search(pattern, text_upper) for pattern in BankExtractor.EMI_PATTERNS)
    
    @staticmethod
    def _is_bounce(text: str) -> bool:
        """Check if transaction is bounce"""
        text_upper = str(text).upper()
        return any(re.search(pattern, text_upper) for pattern in BankExtractor.BOUNCE_PATTERNS)
    
    @staticmethod
    def _extract_credit_amount(line: str) -> float:
        """Extract credit amount from text line"""
        # Look for amount followed by CR/CREDIT
        patterns = [
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:CR|CREDIT)',
            r'(?:CR|CREDIT)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return BankExtractor._parse_amount(match.group(1))
        
        # If CR mentioned, take last amount
        if 'CR' in line.upper():
            amounts = re.findall(r'\d{1,3}(?:,\d{3})*(?:\.\d{2})?', line)
            if amounts:
                return BankExtractor._parse_amount(amounts[-1])
        
        return 0.0
    
    @staticmethod
    def _extract_debit_amount(line: str) -> float:
        """Extract debit amount from text line"""
        patterns = [
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:DR|DEBIT)',
            r'(?:DR|DEBIT)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return BankExtractor._parse_amount(match.group(1))
        
        return 0.0
    
    @staticmethod
    def _calculate_confidence(salary_count: int, emi_count: int, total_txns: int) -> float:
        """
        Calculate extraction confidence score (0.0 to 1.0)
        Based on data completeness
        """
        score = 0.0
        
        # Salary presence (40%)
        if salary_count >= 3:
            score += 0.4
        elif salary_count >= 1:
            score += 0.2
        
        # EMI data (30%)
        if emi_count >= 1:
            score += 0.3
        
        # Overall transaction count (30%)
        if total_txns >= 20:
            score += 0.3
        elif total_txns >= 10:
            score += 0.15
        
        return min(1.0, score)