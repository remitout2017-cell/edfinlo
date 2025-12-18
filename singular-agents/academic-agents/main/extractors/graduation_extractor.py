from extractors.base_extractor import BaseExtractor
from schemas import GraduationMarksheet, GraduationSemester
from analyzers.grade_converter import UniversalGradeConverter
from typing import List, Optional


class GraduationExtractor(BaseExtractor):
    """Extract graduation marksheets (multiple semesters)"""

    PROMPT = """
Extract graduation/bachelor's degree marksheet information from this image.

This may be:
1. A single semester marksheet
2. A consolidated marksheet with all semesters
3. A final degree certificate

Extract:
- Institution/University name
- Degree name (B.Tech, B.Sc, B.Com, etc.)
- Specialization/Branch
- Year of passing
- Duration in years

For each semester/year visible:
- Semester/Year number
- Year of completion
- Marks (percentage/CGPA/SGPA/grade - extract whatever is available)

If this is a final consolidated marksheet, extract ALL semesters visible.
If this is only one semester, extract just that semester.

Be very smart and thorough - extract ALL semester data you can see.
"""

    def extract(self, image_path: str) -> Optional[GraduationMarksheet]:
        """Extract graduation data from single image"""
        print(f"📊 Extracting graduation marksheet...")

        # Use 90 second timeout for graduation (more complex)
        result = self.extract_structured(
            image_path=image_path,
            schema=GraduationMarksheet,
            prompt=self.PROMPT,
            timeout=90  # Longer timeout for graduation
        )

        if result:
            # Convert final grade using UniversalGradeConverter
            conversion = UniversalGradeConverter.convert_to_universal_grade(
                percentage=result.final_percentage,
                cgpa=result.final_cgpa,
                board_name=result.institution_name,
                is_graduation=True
            )

            result.converted_grade = conversion["universal_grade"]

            print(
                f"   ✅ Graduation: {result.degree}, {result.institution_name}")
            print(
                f"      Semesters: {len(result.semesters)}, Final Grade: {result.converted_grade}")
            print(
                f"      Final CGPA/Percentage: {result.final_cgpa or result.final_percentage}")
        else:
            print(f"   ⚠️ Failed to extract from this page (skipping)")

        return result

    def extract_multiple(self, image_paths: List[str]) -> Optional[GraduationMarksheet]:
        """
        Extract from multiple images and merge
        Useful when graduation PDF has multiple pages
        """
        print(f"📚 Extracting graduation from {len(image_paths)} pages...")

        all_results = []
        skipped = 0

        for i, img_path in enumerate(image_paths):
            print(f"   Page {i+1}/{len(image_paths)}...")
            result = self.extract(img_path)

            if result:
                all_results.append(result)
            else:
                skipped += 1
                print(f"   ⭐ Skipped page {i+1} (extraction failed)")

                # If too many failures, stop processing
                if skipped >= 3:
                    print(
                        f"   ⚠️ Too many failures ({skipped}), stopping extraction")
                    break

        if not all_results:
            print("   ❌ No data extracted from any page")
            return None

        print(
            f"   ✅ Successfully extracted from {len(all_results)}/{len(image_paths)} pages")

        # Merge all results
        merged = self._merge_graduation_data(all_results)
        return merged

    def _merge_graduation_data(self, results: List[GraduationMarksheet]) -> GraduationMarksheet:
        """Merge multiple graduation marksheet extractions"""
        # Take basic info from first result
        base = results[0]

        # Collect all semesters from all pages
        all_semesters = []
        for result in results:
            all_semesters.extend(result.semesters)

        # Remove duplicates (same semester from multiple pages)
        unique_semesters = {}
        for sem in all_semesters:
            key = sem.semester_year.lower().strip()
            if key not in unique_semesters:
                unique_semesters[key] = sem

        base.semesters = list(unique_semesters.values())

        # Use the most complete data for final marks
        for result in results:
            if result.final_percentage and not base.final_percentage:
                base.final_percentage = result.final_percentage
            if result.final_cgpa and not base.final_cgpa:
                base.final_cgpa = result.final_cgpa

        # Recalculate converted grade using UniversalGradeConverter
        conversion = UniversalGradeConverter.convert_to_universal_grade(
            percentage=base.final_percentage,
            cgpa=base.final_cgpa,
            board_name=base.institution_name,
            is_graduation=True
        )

        base.converted_grade = conversion["universal_grade"]

        print(f"   ✅ Merged: {len(base.semesters)} unique semesters")
        print(f"      Final Grade: {base.converted_grade}")

        return base
