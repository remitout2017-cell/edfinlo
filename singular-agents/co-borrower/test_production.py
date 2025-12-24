"""
Production Test Suite for Co-Borrower Agent
"""
import pytest
from pathlib import Path
from main import LoanApprovalEngine


def test_complete_flow():
    """Test complete co-borrower financial analysis"""

    # Initialize engine
    engine = LoanApprovalEngine()

    # Test files (update with your actual test files)
    test_data = {
        "salary_slip": "testdata/salary_slips.pdf",
        "bank_statement": "testdata/bank_statement.pdf",
        "itr_1": "testdata/itr_2023_24.pdf",
        "itr_2": "testdata/itr_2022_23.pdf",
    }

    # Process application
    result = engine.process_loan_application(
        salary_slip_pdf=test_data["salary_slip"],
        bank_statement_pdf=test_data["bank_statement"],
        itr_pdf_1=test_data["itr_1"],
        itr_pdf_2=test_data["itr_2"]
    )

    # Assertions
    assert result.status == "success"
    assert result.bank_data is not None
    assert result.salary_data is not None
    assert result.itr_data is not None
    assert result.foir_result is not None
    assert result.cibil_estimate is not None

    # Check bounce metrics
    assert hasattr(result.bank_data, 'bounce_count')
    assert hasattr(result.bank_data, 'dishonor_count')
    assert hasattr(result.bank_data, 'insufficient_fund_incidents')

    print("✅ All tests passed!")
    print(f"FOIR: {result.foir_result.foir_percentage}%")
    print(f"CIBIL Estimate: {result.cibil_estimate.estimated_score}")
    print(f"Bounce Count: {result.bank_data.bounce_count}")


if __name__ == "__main__":
    test_complete_flow()
