from extractors.base_extractor import BaseExtractor
from schemas import Class10Marksheet
from analyzers.grade_converter import UniversalGradeConverter
from typing import Optional


class Class10Extractor(BaseExtractor):
    """Extract 10th marksheet data"""

    PROMPT = """
Extract Class 10 marksheet information. This can be from ANY Indian board:
- CBSE, ICSE, State Boards (Maharashtra, Tamil Nadu, Karnataka, etc.)

Extract:
1. **Board name** - Full exact name as written (very important!)
2. **Year of passing**
3. **Roll number**
4. **School/Institution name**

5. **Academic Performance** - Extract EVERYTHING you see:
   - If **overall percentage** is shown → extract it
   - If **individual subject marks** are shown → calculate overall percentage
     Example: Subjects: 82, 89, 87, 71, 76, 87 → Average = (82+89+87+71+76+87)/6 = 82%
   - If **CGPA** is shown → extract CGPA (mention if it's 10-point or 4-point scale)
   - If **grade** is shown → extract exact grade (A1, A, Distinction, First Class, etc.)
   - If **division** is shown → extract division (First Division, Second Division, etc.)

Be very accurate with board name - write it EXACTLY as shown on marksheet.
Extract ALL types of grades/marks you see - don't miss anything!
"""

    def extract(self, image_path: str) -> Optional[Class10Marksheet]:
        print(f"📊 Extracting 10th marksheet...")

        result = self.extract_structured(
            image_path=image_path,
            schema=Class10Marksheet,
            prompt=self.PROMPT
        )

        if result:
            # Universal grade conversion
            conversion = UniversalGradeConverter.convert_to_universal_grade(
                percentage=result.percentage,
                cgpa=result.cgpa,
                existing_grade=result.grade or result.division,
                board_name=result.board_name,
                is_graduation=False
            )

            result.board_type = conversion["board_type"]
            result.universal_grade = conversion["universal_grade"]
            result.normalized_percentage = conversion["percentage"]
            result.conversion_info = {
                "method": conversion["conversion_method"],
                "original": conversion["original_grade"]
            }

            print(f"   ✅ 10th: {result.board_name}")
            print(f"      Board Type: {result.board_type}")
            print(f"      Original: {conversion['original_grade']}")
            print(f"      Universal Grade: {result.universal_grade}")

        return result
