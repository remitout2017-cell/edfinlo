from extractors.base_extractor import BaseExtractor
from schemas import Class12Marksheet
from analyzers.grade_converter import GradeConverter
from typing import Optional


class Class12Extractor(BaseExtractor):
    """Extract 12th marksheet data"""

    PROMPT = """
Extract Class 12 marksheet information from this image.

Look for:
- Board name (CBSE, ICSE, State Board, etc.)
- Year of passing
- Stream (Science/Commerce/Arts)
- School name
- Marks: percentage OR CGPA OR grade (extract whatever is available)

Be smart and extract ALL available information accurately.
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
            result.converted_grade = GradeConverter.convert_to_grade(
                percentage=result.percentage,
                cgpa=result.cgpa,
                existing_grade=result.grade
            )
            print(
                f"   ✅ 12th: {result.board_name}, {result.year_of_passing}, Grade: {result.converted_grade}")

        return result
