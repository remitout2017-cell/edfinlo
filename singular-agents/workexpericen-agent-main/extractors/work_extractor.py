from extractors.base_extractor import BaseExtractor
from schemas import WorkExperience
from typing import Optional, List


class WorkExperienceExtractor(BaseExtractor):
    """Extract work experience from documents"""

    PROMPT = """
Extract work experience information from this employment document.

ANALYZE THIS DOCUMENT AND EXTRACT:

1. **Company Name** - Look for:
   - Company logo or letterhead at top
   - "From:", "Company:", "Organization:" labels
   - Email domain (e.g., @company.com → "Company")
   - Footer/signature company name
   - ANY company identifier

2. **Job Title/Position** - Look for:
   - "Position:", "Designation:", "Role:", "Title:"
   - "You are appointed as [TITLE]"
   - "Joining as [TITLE]"
   - Near employee name or signature

3. **Employment Type** - Determine from:
   - "Full-time", "Permanent" → full_time
   - "Part-time" → part_time
   - "Intern", "Internship" → internship_paid or internship_unpaid
   - "Contract", "Contractual" → contract
   - "Freelance" → freelance
   - "Volunteer" → volunteer
   - Default to full_time if unclear

4. **Dates** - Look for:
   - "Date of Joining:", "Start Date:", "From:"
   - "Date of Relieving:", "Last Working Day:", "To:"
   - "Currently working", "Till date", "Present" → currently_working: true
   - Format as DD/MM/YYYY (e.g., 15/03/2023)

5. **Salary/Stipend** - Look for:
   - "CTC:", "Salary:", "Stipend:", "Compensation:"
   - "Per month:", "Monthly:", "Annual:"
   - Convert annual to monthly (divide by 12)
   - Extract number only (e.g., "₹25,000" → 25000)

6. **Payment Status**:
   - Only set is_paid: false if explicitly says "unpaid" or "volunteer"
   - Otherwise assume is_paid: true

IMPORTANT RULES:
- If you see ANYTHING that looks like a company name, extract it (even partial)
- If you see ANY job title or position, extract it (even if informal)
- Date format MUST be DD/MM/YYYY
- Return null only if truly nothing found
- Set extraction_confidence based on clarity:
  * 0.9-1.0: All fields clear and readable
  * 0.7-0.9: Most fields found, some unclear
  * 0.5-0.7: Minimal info, poor quality
  * <0.5: Almost nothing extracted

Extract ALL information you can find, even if incomplete.
"""

    def extract(self, image_path: str) -> Optional[WorkExperience]:
        """Extract work experience from single image"""
        print(f"📊 Extracting work experience...")

        result = self.extract_structured(
            image_path=image_path,
            schema=WorkExperience,
            prompt=self.PROMPT,
            timeout=90  # Longer timeout for complex documents
        )

        if result:
            print(f"   ✅ Extracted:")
            print(f"      Company: {result.company_name or 'Not found'}")
            print(f"      Position: {result.job_title or 'Not found'}")
            print(f"      Type: {result.employment_type}")
            print(f"      Dates: {result.start_date or 'N/A'} to {result.end_date or 'Present' if result.currently_working else 'N/A'}")
            print(f"      Confidence: {result.extraction_confidence:.2f}")
        else:
            print(f"   ⚠️ Failed to extract from this document")

        return result

    def extract_multiple(self, image_paths: List[str]) -> List[WorkExperience]:
        """
        Extract from multiple images
        Useful when PDF has multiple pages
        """
        print(f"📚 Extracting work experience from {len(image_paths)} pages...")

        all_results = []
        skipped = 0

        for i, img_path in enumerate(image_paths):
            print(f"   Page {i+1}/{len(image_paths)}...")
            result = self.extract(img_path)

            if result and result.extraction_confidence >= 0.3:
                all_results.append(result)
            else:
                skipped += 1
                print(f"   ⭐ Skipped page {i+1} (low confidence or failed)")

                # If too many failures, stop processing
                if skipped >= 3:
                    print(f"   ⚠️ Too many failures ({skipped}), stopping extraction")
                    break

        if not all_results:
            print("   ❌ No data extracted from any page")
            return []

        print(f"   ✅ Successfully extracted from {len(all_results)}/{len(image_paths)} pages")
        return all_results