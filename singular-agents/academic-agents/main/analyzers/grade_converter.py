from config import Config
from typing import Optional, Tuple
import re

class UniversalGradeConverter:
    """
    Universal grade converter for ALL Indian education boards
    Handles: CBSE, ICSE, State Boards, University systems
    """
    
    @staticmethod
    def detect_board_type(board_name: str) -> str:
        """
        Detect board type from board name
        Returns: 'cbse', 'icse', 'maharashtra', etc.
        """
        if not board_name:
            return "unknown"
        
        board_lower = board_name.lower()
        
        for board_type, keywords in Config.BOARD_KEYWORDS.items():
            if any(keyword in board_lower for keyword in keywords):
                return board_type
        
        # Default to state board if not recognized
        return "state"
    
    @staticmethod
    def normalize_grade_string(grade: str) -> str:
        """Clean and normalize grade strings"""
        if not grade:
            return ""
        
        # Remove special characters, extra spaces
        normalized = re.sub(r'[^\w\s-]', '', grade.lower().strip())
        normalized = re.sub(r'\s+', ' ', normalized)
        return normalized
    
    @staticmethod
    def convert_state_board_grade(grade: str, board_type: str) -> Tuple[str, Optional[float]]:
        """
        Convert state board specific grades (Division/Class system)
        Returns: (universal_grade, estimated_percentage)
        """
        grade_normalized = UniversalGradeConverter.normalize_grade_string(grade)
        
        # Check against known state board grades
        for grade_key, (universal_grade, min_percentage) in Config.STATE_BOARD_GRADES.items():
            if grade_key in grade_normalized:
                # Estimate mid-point percentage
                if "distinction" in grade_key or "i-dist" in grade_key:
                    estimated_pct = 80.0  # Mid-range for distinction
                elif "first" in grade_key or "i-class" in grade_key:
                    estimated_pct = 65.0  # Mid-range for first class
                elif "second" in grade_key or "ii-class" in grade_key:
                    estimated_pct = 55.0  # Mid-range for second class
                else:
                    estimated_pct = min_percentage + 5
                
                return (universal_grade, estimated_pct)
        
        return (grade, None)
    
    @staticmethod
    def percentage_to_cbse_grade(percentage: float) -> str:
        """Convert percentage to CBSE grade scale"""
        for (min_marks, max_marks), grade in Config.CBSE_GRADE_SCALE.items():
            if min_marks <= percentage <= max_marks:
                return grade
        return "Invalid"
    
    @staticmethod
    def percentage_to_icse_grade(percentage: float) -> str:
        """Convert percentage to ICSE grade scale"""
        for (min_marks, max_marks), grade in Config.ICSE_GRADE_SCALE.items():
            if min_marks <= percentage <= max_marks:
                return grade
        return "F"
    
    @staticmethod
    def cgpa_to_percentage(cgpa: float, board_type: str = "cbse", scale: int = 10) -> float:
        """
        Convert CGPA to percentage based on board type [web:58]
        """
        if scale == 4:
            # 4-point GPA to percentage (international)
            return (cgpa / 4.0) * 100
        
        # 10-point CGPA
        if board_type in ["cbse", "icse"]:
            return cgpa * Config.CGPA_TO_PERCENTAGE["cbse"]  # × 9.5
        elif board_type == "graduation":
            return cgpa * Config.CGPA_TO_PERCENTAGE["graduation"]  # × 9.5
        else:
            return cgpa * Config.CGPA_TO_PERCENTAGE["state"]  # × 10
    
    @staticmethod
    def graduation_cgpa_to_grade(cgpa: float) -> str:
        """Convert graduation CGPA to grade"""
        for (min_cgpa, max_cgpa), grade in Config.GRADUATION_CGPA_SCALE.items():
            if min_cgpa <= cgpa <= max_cgpa:
                return grade
        return "F"
    
    @staticmethod
    def convert_to_universal_grade(
        percentage: Optional[float] = None,
        cgpa: Optional[float] = None,
        existing_grade: Optional[str] = None,
        board_name: Optional[str] = None,
        is_graduation: bool = False
    ) -> dict:
        """
        Universal grade conversion - works for ANY Indian board
        
        Returns:
        {
            "universal_grade": "A1",
            "original_grade": "I-DIST",
            "percentage": 80.0,
            "board_type": "maharashtra",
            "conversion_method": "state_board_mapping"
        }
        """
        result = {
            "universal_grade": "Not Available",
            "original_grade": existing_grade or "Not Provided",
            "percentage": percentage,
            "board_type": "unknown",
            "conversion_method": "none"
        }
        
        # Detect board type
        if board_name:
            result["board_type"] = UniversalGradeConverter.detect_board_type(board_name)
        
        # Priority 1: If existing grade (for state boards with division system)
        if existing_grade and existing_grade.strip():
            # Try state board grade conversion
            universal_grade, estimated_pct = UniversalGradeConverter.convert_state_board_grade(
                existing_grade, 
                result["board_type"]
            )
            
            if estimated_pct:
                result["universal_grade"] = universal_grade
                result["percentage"] = percentage or estimated_pct
                result["conversion_method"] = "state_board_mapping"
                return result
            
            # Check if it's already in CBSE format (A1, A2, etc.)
            grade_upper = existing_grade.strip().upper()
            if grade_upper in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D', 'E1', 'E2']:
                result["universal_grade"] = grade_upper
                result["conversion_method"] = "direct_cbse"
                return result
        
        # Priority 2: If percentage is available
        if percentage is not None:
            result["percentage"] = percentage
            
            if is_graduation:
                # For graduation, convert to university grade
                result["universal_grade"] = UniversalGradeConverter.percentage_to_cbse_grade(percentage)
                result["conversion_method"] = "percentage_to_cbse"
            elif result["board_type"] == "icse":
                result["universal_grade"] = UniversalGradeConverter.percentage_to_icse_grade(percentage)
                result["conversion_method"] = "percentage_to_icse"
            else:
                # Default to CBSE scale (most common)
                result["universal_grade"] = UniversalGradeConverter.percentage_to_cbse_grade(percentage)
                result["conversion_method"] = "percentage_to_cbse"
            
            return result
        
        # Priority 3: If CGPA is available
        if cgpa is not None:
            if is_graduation:
                # Graduation CGPA to grade
                result["universal_grade"] = UniversalGradeConverter.graduation_cgpa_to_grade(cgpa)
                result["percentage"] = UniversalGradeConverter.cgpa_to_percentage(
                    cgpa, "graduation"
                )
                result["conversion_method"] = "cgpa_to_grade_graduation"
            else:
                # School CGPA to percentage to grade
                converted_percentage = UniversalGradeConverter.cgpa_to_percentage(
                    cgpa, 
                    result["board_type"]
                )
                result["percentage"] = converted_percentage
                result["universal_grade"] = UniversalGradeConverter.percentage_to_cbse_grade(
                    converted_percentage
                )
                result["conversion_method"] = "cgpa_to_percentage_to_grade"
            
            return result
        
        return result
