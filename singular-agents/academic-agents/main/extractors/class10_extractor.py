from extractors.base_extractor import BaseExtractor
from schemas import Class10Marksheet
from analyzers.grade_converter import GradeConverter
from typing import Optional


class Class10Extractor(BaseExtractor):
    """Extract 10th marksheet data"""

    PROMPT = """
Extract Class 10 marksheet information.

IMPORTANT:
- If individual subject marks are shown, calculate OVERALL percentage from ALL subjects
- Example: If marks are 82, 89, 87, 71, 76, 87 → Average = (82+89+87+71+76+87)/6 = 82%
- If overall percentage is directly mentioned, use that
- If CGPA is given, extract CGPA
- If grade is given (A, B, etc.), extract grade

Look for:
- Board name (ICSE, CBSE, State Board, etc.)
- Year of passing
- Roll number
- School name
- Overall percentage OR CGPA OR grade

Extract the OVERALL academic performance, not individual subject marks.
"""

    def extract(self, image_path: str) -> Optional[Class10Marksheet]:
        """Extract 10th marksheet"""
        print(f"📊 Extracting 10th marksheet...")

        result = self.extract_structured(
            image_path=image_path,
            schema=Class10Marksheet,
            prompt=self.PROMPT
        )

        if result:
            # Convert to standard grade
            result.converted_grade = GradeConverter.convert_to_grade(
                percentage=result.percentage,
                cgpa=result.cgpa,
                existing_grade=result.grade
            )
            print(
                f"   ✅ 10th: {result.board_name}, {result.year_of_passing}, Grade: {result.converted_grade}")

        return result
