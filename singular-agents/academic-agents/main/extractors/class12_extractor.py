from extractors.base_extractor import BaseExtractor
from schemas import Class12Marksheet
from analyzers.grade_converter import UniversalGradeConverter
from typing import Optional


class Class12Extractor(BaseExtractor):
    """Extract 12th marksheet data"""

    PROMPT = """
Extract Class 12 marksheet information. This can be from ANY Indian board:
- CBSE, ICSE/ISC, State Boards, IB, Cambridge, NIOS, etc.

Extract:
1. **Board name** - Exact full name as written
2. **Year of passing**
3. **Stream** - Science/Commerce/Arts/Humanities (if mentioned)
4. **Roll number**
5. **School name**

6. **Academic Performance** - Extract everything:
   - Overall percentage
   - Individual subject marks (if overall not given)
   - CGPA (with scale - 10-point/4-point)
   - Grade (A1, A, Distinction, First Class, I-DIST, etc.)
   - Division (if mentioned)

Board name is critical - write it exactly as shown!
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
