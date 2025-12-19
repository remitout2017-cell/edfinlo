from schemas import FOIRResult
from config import Config

class FOIREngine:
    """Calculate FOIR - Pure Math"""
    
    @staticmethod
    def calculate(monthly_income: float, monthly_emi: float) -> FOIRResult:
        """
        FOIR = (Total Monthly EMI / Net Monthly Income) × 100
        """
        
        if monthly_income <= 0:
            return FOIRResult(
                foir=100.0,
                monthly_income=0.0,
                monthly_emi=monthly_emi,
                status="critical"
            )
        
        foir = (monthly_emi / monthly_income) * 100
        
        # Determine status
        if foir <= Config.IDEAL_FOIR:
            status = "low"
        elif foir <= Config.MAX_FOIR_ACCEPTABLE:
            status = "medium"
        elif foir <= 80:
            status = "high"
        else:
            status = "critical"
        
        return FOIRResult(
            foir=round(foir, 2),
            monthly_income=round(monthly_income, 2),
            monthly_emi=round(monthly_emi, 2),
            status=status
        )
