"""
Deterministic bank metrics computation - PRODUCTION READY
✅ FIXED: Added bounce/dishonor/insufficient fund detection
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
import re
import math
from collections import defaultdict

DATE_FORMATS = ["%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%b-%Y", "%d %b %Y"]


def _parse_date(s: str) -> Optional[date]:
    """Parse date string to date object"""
    if not s:
        return None
    s = s.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except Exception:
            pass
    return None


def _month_key(d: date) -> str:
    """Convert date to YYYY-MM month key"""
    return f"{d.year:04d}-{d.month:02d}"


def _norm_text(s: str) -> str:
    """Normalize text for matching"""
    return re.sub(r"\s+", " ", (s or "")).strip().upper()


def _safe_float(x) -> float:
    """Convert any value to float safely"""
    try:
        if x is None:
            return 0.0
        if isinstance(x, (int, float)):
            return float(x)
        s = str(x).replace(",", "").replace("₹", "").strip()
        if s == "" or s.lower() == "null":
            return 0.0
        return float(s)
    except Exception:
        return 0.0


@dataclass
class Txn:
    """Transaction object"""
    txn_date: date
    narration: str
    debit: float
    credit: float
    balance: float

    @property
    def amount(self) -> float:
        return self.debit if self.debit > 0 else self.credit


def _to_txns(raw_txns: List[Dict]) -> List[Txn]:
    """Convert raw transaction dicts to Txn objects"""
    out: List[Txn] = []
    for t in raw_txns or []:
        d = _parse_date(t.get("date") or t.get("txn_date") or "")
        if not d:
            continue
        out.append(
            Txn(
                txn_date=d,
                narration=t.get("narration") or t.get("particulars") or "",
                debit=_safe_float(t.get("debit")),
                credit=_safe_float(t.get("credit")),
                balance=_safe_float(t.get("balance"))
            )
        )
    out.sort(key=lambda x: x.txn_date)
    return out


# Detection keywords
EMI_KEYWORDS = re.compile(
    r"\bEMI\b|NACH|ECS|ACH|AUTO\s*DEBIT|INSTAL|INSTALL|LOAN|FINANCE|HOME\s*FIN|PL\b|HL\b",
    re.IGNORECASE
)

SALARY_KEYWORDS = re.compile(r"\bSALARY\b|\bPAYROLL\b", re.IGNORECASE)

# ✅ NEW: Bounce/Dishonor Detection
BOUNCE_KEYWORDS = re.compile(
    r"\bBOUNCE\b|\bBOUNCED\b|\bRETURN\s*CHE?Q\b|\bCHE?Q\s*RETURN\b|\bRETURNED\b|"
    r"\bREVERSAL\b|\bDISHONOU?RED?\b|\bINSUFF\b|\bINSUFFICIENT\s*FUND\b|"
    r"\bECS\s*RETURN\b|\bNACH\s*RETURN\b|\bPAYMENT\s*FAIL\b|\bFAILED\s*PAYMENT\b|"
    r"\bCHQ\s*RTN\b|\bPENALTY\b|\bBOUNCE\s*CHARGE\b",
    re.IGNORECASE
)


def detect_salary_credits(txns: List[Txn], employer_name: Optional[str] = None) -> List[Txn]:
    """Detect salary credits using keywords and employer name"""
    employer_tokens = []
    if employer_name:
        toks = [t for t in re.split(
            r"[^A-Za-z0-9]+", employer_name.upper()) if len(t) >= 4]
        employer_tokens = toks[:6]

    hits: List[Txn] = []
    for t in txns:
        if t.credit <= 0:
            continue
        nar = _norm_text(t.narration)
        if SALARY_KEYWORDS.search(nar):
            hits.append(t)
            continue
        if employer_tokens and any(tok in nar for tok in employer_tokens):
            hits.append(t)
    return hits


def detect_emi_debits(txns: List[Txn]) -> List[Txn]:
    """Detect EMI debits using keywords and recurrence patterns"""
    candidates = [t for t in txns if t.debit >
                  0 and EMI_KEYWORDS.search(t.narration or "")]

    if not candidates:
        candidates = [t for t in txns if t.debit > 0 and re.search(
            r"NACH|ECS|ACH", t.narration or "", re.I)]

    by_amount_months: Dict[int, set] = defaultdict(set)
    by_amount: Dict[int, List[Txn]] = defaultdict(list)
    for t in candidates:
        amt = int(round(t.debit))
        by_amount_months[amt].add(_month_key(t.txn_date))
        by_amount[amt].append(t)

    recurring_amounts = {amt for amt,
                         months in by_amount_months.items() if len(months) >= 3}
    strong: List[Txn] = []
    for amt in recurring_amounts:
        strong.extend(by_amount[amt])

    if not strong:
        strong = candidates

    # Deduplicate
    seen = set()
    uniq = []
    for t in strong:
        key = (t.txn_date, int(round(t.debit)), _norm_text(t.narration))
        if key not in seen:
            seen.add(key)
            uniq.append(t)

    uniq.sort(key=lambda x: x.txn_date)
    return uniq

# ✅ NEW: Detect Bounce/Dishonor/Insufficient Fund Incidents


def detect_bounce_incidents(txns: List[Txn]) -> Dict[str, int]:
    """
    Detect bounce, dishonor, and insufficient fund incidents.
    Returns: {bounce_count, dishonor_count, insufficient_fund_incidents}
    """
    bounce_count = 0
    dishonor_count = 0
    insufficient_fund_incidents = 0

    for t in txns:
        nar = _norm_text(t.narration)

        if not BOUNCE_KEYWORDS.search(nar):
            continue

        # Classify the type of incident
        is_bounce = re.search(r"\bBOUNCE\b|\bBOUNCED\b|\bRETURN", nar, re.I)
        is_dishonor = re.search(r"\bDISHONOU?R", nar, re.I)
        is_insufficient = re.search(
            r"\bINSUFF\b|\bINSUFFICIENT\s*FUND", nar, re.I)

        # Count each category
        if is_insufficient:
            insufficient_fund_incidents += 1
        if is_dishonor:
            dishonor_count += 1
        if is_bounce:
            bounce_count += 1

        # If none matched but BOUNCE_KEYWORDS did, count as generic bounce
        if not (is_bounce or is_dishonor or is_insufficient):
            bounce_count += 1

    return {
        "bounce_count": bounce_count,
        "dishonor_count": dishonor_count,
        "insufficient_fund_incidents": insufficient_fund_incidents
    }


def weighted_average_balance(txns: List[Txn]) -> Tuple[float, float]:
    """Calculate weighted average balance"""
    if not txns:
        return 0.0, 0.0

    valid_txns = [t for t in txns if t.balance >= 0]
    if not valid_txns:
        return 0.0, 0.0

    if len(valid_txns) == 1:
        bal = valid_txns[0].balance
        return round(bal, 2), round(bal, 2)

    total_days = 0
    weighted_sum = 0.0
    min_bal = math.inf

    for i in range(len(valid_txns)):
        cur = valid_txns[i]
        min_bal = min(min_bal, cur.balance)

        if i + 1 < len(valid_txns):
            days = max(1, (valid_txns[i + 1].txn_date - cur.txn_date).days)
        else:
            days = 1

        total_days += days
        weighted_sum += cur.balance * days

    avg = (weighted_sum / total_days) if total_days else 0.0
    return round(avg, 2), round(min_bal if min_bal != math.inf else 0.0, 2)


def compute_bank_metrics(
    raw_transactions: List[Dict],
    employer_name: Optional[str] = None,
) -> Dict:
    """
    Compute precise bank metrics from transaction list.
    ✅ FIXED: Now includes bounce_count, dishonor_count, insufficient_fund_incidents
    """
    txns = _to_txns(raw_transactions)

    # Handle empty transactions
    if not txns:
        return {
            "total_credits": 0.0,
            "total_debits": 0.0,
            "credit_count": 0,
            "debit_count": 0,
            "average_monthly_balance": 0.0,
            "minimum_balance": 0.0,
            "salary_credits_detected": 0,
            "average_monthly_salary": 0.0,
            "salary_consistency_months": 0,
            "last_salary_date": None,
            "total_emi_debits": 0.0,
            "average_monthly_emi": 0.0,
            "emi_transactions": [],
            "unique_loan_accounts": 0,
            "average_monthly_spending": 0.0,
            "bounce_count": 0,
            "dishonor_count": 0,
            "insufficient_fund_incidents": 0,
        }

    totals = {
        "total_credits": round(sum(t.credit for t in txns), 2),
        "total_debits": round(sum(t.debit for t in txns), 2),
        "credit_count": sum(1 for t in txns if t.credit > 0),
        "debit_count": sum(1 for t in txns if t.debit > 0),
    }

    avg_bal, min_bal = weighted_average_balance(txns)

    # Salary detection
    salary_hits = detect_salary_credits(txns, employer_name=employer_name)
    salary_by_month: Dict[str, List[Txn]] = defaultdict(list)
    for t in salary_hits:
        salary_by_month[_month_key(t.txn_date)].append(t)

    salary_months = sorted(salary_by_month.keys())
    salary_amounts = []
    last_salary_date = None

    for m in salary_months:
        mx = max(salary_by_month[m], key=lambda x: x.credit)
        salary_amounts.append(mx.credit)
        last_salary_date = mx.txn_date

    avg_monthly_salary = round(
        sum(salary_amounts) / len(salary_amounts), 2) if salary_amounts else 0.0

    # EMI detection
    emi_hits = detect_emi_debits(txns)
    emi_by_month: Dict[str, float] = defaultdict(float)
    for t in emi_hits:
        emi_by_month[_month_key(t.txn_date)] += t.debit

    all_months = sorted({_month_key(t.txn_date) for t in txns})
    avg_monthly_emi = round(
        sum(emi_by_month.get(m, 0.0) for m in all_months) / len(all_months), 2
    ) if all_months else 0.0

    emi_transactions = [
        {
            "date": t.txn_date.isoformat(),
            "narration": t.narration,
            "amount": round(t.debit, 2),
            "balance": round(t.balance, 2),
        }
        for t in emi_hits
    ]

    # ✅ Bounce/Dishonor Detection
    bounce_data = detect_bounce_incidents(txns)

    # Spending calculation
    emi_keys = {
        (t.txn_date, int(round(t.debit)), _norm_text(t.narration))
        for t in emi_hits
    }

    non_emi_debits = [
        t for t in txns
        if t.debit > 0 and (t.txn_date, int(round(t.debit)), _norm_text(t.narration)) not in emi_keys
    ]

    spend_by_month: Dict[str, float] = defaultdict(float)
    for t in non_emi_debits:
        spend_by_month[_month_key(t.txn_date)] += t.debit

    avg_monthly_spending = round(
        (sum(spend_by_month.get(m, 0.0)
         for m in all_months) / len(all_months)) if all_months else 0.0, 2
    )

    return {
        **totals,
        "average_monthly_balance": avg_bal,
        "minimum_balance": min_bal,
        "salary_credits_detected": sum(len(v) for v in salary_by_month.values()),
        "average_monthly_salary": avg_monthly_salary,
        "salary_consistency_months": len(salary_months),
        "last_salary_date": last_salary_date.isoformat() if last_salary_date else None,
        "total_emi_debits": round(sum(t.debit for t in emi_hits), 2),
        "average_monthly_emi": avg_monthly_emi,
        "emi_transactions": emi_transactions,
        "unique_loan_accounts": max(0, len({int(round(t.debit)) for t in emi_hits})),
        "average_monthly_spending": avg_monthly_spending,
        # ✅ NEW: Bounce/Dishonor metrics
        "bounce_count": bounce_data["bounce_count"],
        "dishonor_count": bounce_data["dishonor_count"],
        "insufficient_fund_incidents": bounce_data["insufficient_fund_incidents"],
    }
