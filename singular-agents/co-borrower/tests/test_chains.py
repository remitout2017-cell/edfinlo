"""
Unit tests for chains
"""
import pytest
from pathlib import Path
from chains import ITRChain, BankStatementChain, SalarySlipChain, FOIRChain, CIBILChain


class TestChains:
    """Test all chains"""
    
    @pytest.fixture
    def sample_files(self):
        """Sample test files"""
        return {
            "itr": Path("testingdata/Anil Shah- Father/itr.pdf"),
            "bank": Path("testingdata/Anil Shah- Father/bankstatement_page-0001.pdf"),
            "salary": Path("testingdata/Anil Shah- Father/salaryslip.pdf")
        }
    
    def test_itr_chain(self, sample_files):
        """Test ITR extraction"""
        if not sample_files["itr"].exists():
            pytest.skip("Test file not found")
        
        chain = ITRChain()
        result = chain.process([str(sample_files["itr"])])
        
        assert result is not None
        assert result.extraction_confidence >= 0
        assert result.average_annual_income >= 0
    
    def test_bank_chain(self, sample_files):
        """Test bank statement extraction"""
        if not sample_files["bank"].exists():
            pytest.skip("Test file not found")
        
        chain = BankStatementChain()
        result = chain.process(str(sample_files["bank"]))
        
        assert result is not None
        assert result.extraction_confidence >= 0
    
    def test_salary_chain(self, sample_files):
        """Test salary slip extraction"""
        if not sample_files["salary"].exists():
            pytest.skip("Test file not found")
        
        chain = SalarySlipChain()
        result = chain.process(str(sample_files["salary"]))
        
        assert result is not None
        assert result.extraction_confidence >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
