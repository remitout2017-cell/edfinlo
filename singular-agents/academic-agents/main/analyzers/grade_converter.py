from config import Config
from typing import Optional


class GradeConverter:
    """Enhanced grade converter"""
    
    # Maharashtra board specific grades
    MAHARASHTRA_GRADES = {
        "distinction": "A1",
        "i-dist": "A1",
        "first class": "A2",
        "second class": "B1",
        "pass class": "C1"
    }
    
    @staticmethod
    def convert_to_grade(percentage: Optional[float] = None, 
                        cgpa: Optional[float] = None,
                        existing_grade: Optional[str] = None) -> str:
        """
        Smart grade conversion with board-specific handling
        """
        # Handle board-specific grades
        if existing_grade:
            grade_lower = existing_grade.lower().strip()
            
            # Check Maharashtra grades
            if grade_lower in GradeConverter.MAHARASHTRA_GRADES:
                return GradeConverter.MAHARASHTRA_GRADES[grade_lower]
            
            # Check if it's already CBSE format (A1, A2, etc.)
            if grade_lower in ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd', 'e1', 'e2']:
                return existing_grade.upper()
        
        # If percentage exists, use it
        if percentage is not None:
            return GradeConverter.percentage_to_grade(percentage)
        
        # If CGPA exists, convert it
        if cgpa is not None:
            percentage = GradeConverter.cgpa_to_percentage(cgpa)
            return GradeConverter.percentage_to_grade(percentage)
        
        return "Not Available"

