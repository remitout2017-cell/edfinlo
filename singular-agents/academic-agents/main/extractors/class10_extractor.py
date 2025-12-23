from extractors.base_extractor import BaseExtractor
from schemas import Class10Marksheet, ConversionInfo
from analyzers.grade_converter import UniversalGradeConverter
from typing import Optional


class Class10Extractor(BaseExtractor):
    """Extract 10th marksheet data with native JSON mode"""

    PROMPT = """
Extract Class 10 marksheet information. This can be from ANY Indian board:
- CBSE, ICSE, State Boards (Maharashtra, Tamil Nadu, Karnataka, etc.)

Extract the following fields accurately:

1. **board_name** (string, required): Full exact board name as written on the marksheet
2. **year_of_passing** (integer, required): Year student passed 10th standard
3. **roll_number** (string, optional): Student's roll number
4. **school_name** (string, optional): Full school/institution name

5. **Academic Performance** - Extract ALL available information:
   - **percentage** (float, optional): Overall percentage if shown
   - **cgpa** (float, optional): CGPA if shown
   - **cgpa_scale** (integer, optional): 10 for 10-point scale, 4 for 4-point scale (default: 10)
   - **grade** (string, optional): Any grade shown (A1, A, Distinction, First Class, etc.)
   - **division** (string, optional): Division if mentioned (First Division, Second Division, etc.)

IMPORTANT INSTRUCTIONS:
- Extract EXACTLY what you see on the marksheet
- If a field is not visible, set it to null
- For percentage: If individual subject marks are shown but no overall percentage, calculate the average
  Example: Subjects: 82, 89, 87, 71, 76, 87 → Average = (82+89+87+71+76+87)/6 = 82%
- Board name must be complete and accurate - this is critical for grade conversion
- Extract ALL types of grades/marks you see - don't miss anything!
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
            result.conversion_info = ConversionInfo(
                conversion_method=conversion["conversion_method"],
                original_grade=conversion["original_grade"]
            )

            print(f"   ✅ 10th: {result.board_name}")
            print(f"   Board Type: {result.board_type}")
            print(f"   Original: {conversion['original_grade']}")
            print(f"   Universal Grade: {result.universal_grade}")

        return result
