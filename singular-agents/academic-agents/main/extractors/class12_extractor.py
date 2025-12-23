from extractors.base_extractor import BaseExtractor
from schemas import Class12Marksheet
from analyzers.grade_converter import UniversalGradeConverter
from typing import Optional


class Class12Extractor(BaseExtractor):
    """Extract 12th marksheet data with native JSON mode"""

    PROMPT = """
Extract Class 12 marksheet information. This can be from ANY Indian board:
- CBSE, ICSE/ISC, State Boards, IB, Cambridge, NIOS, etc.

Extract the following fields accurately:

1. **board_name** (string, required): Exact full board name as written on marksheet
2. **year_of_passing** (integer, required): Year student passed 12th standard
3. **stream** (string, optional): Science/Commerce/Arts/Humanities (if mentioned)
4. **school_name** (string, optional): Full school/institution name

5. **Academic Performance** - Extract ALL available information:
   - **percentage** (float, optional): Overall percentage if shown
   - **cgpa** (float, optional): CGPA if shown
   - **grade** (string, optional): Any grade (A1, A, Distinction, First Class, I-DIST, etc.)

IMPORTANT INSTRUCTIONS:
- Extract EXACTLY what you see on the marksheet
- If a field is not visible, set it to null
- For percentage: If individual subject marks shown but no overall, calculate average
- Board name must be complete and accurate - critical for grade conversion
- Extract ALL types of grades/marks you see
"""

    def extract(self, image_path: str) -> Optional[Class12Marksheet]:
        """Extract 12th marksheet"""
        print(f"📊 Extracting 12th marksheet...")

        result = self.extract_structured(
            image_path=image_path,
            schema=Class12Marksheet,
            prompt=self.PROMPT
        )

        if result:
            # Convert to standard grade
            conversion = UniversalGradeConverter.convert_to_universal_grade(
                percentage=result.percentage,
                cgpa=result.cgpa,
                existing_grade=result.grade,
                board_name=result.board_name,
                is_graduation=False
            )
            result.converted_grade = conversion["universal_grade"]
            print(
                f"   ✅ 12th: {result.board_name}, {result.year_of_passing}, Grade: {result.converted_grade}")

        return result
