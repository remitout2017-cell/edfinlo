from extractors.base_extractor import BaseExtractor
from schemas import AdmissionLetter
from typing import Optional, List

class AdmissionLetterExtractor(BaseExtractor):
    """Extract admission letter information from documents"""
    
    PROMPT = """
Extract admission/offer letter information from this university document.

ANALYZE THIS DOCUMENT AND EXTRACT:

1. **University Name** - Look for:
   - University logo or letterhead at top
   - "From:", "University:", "Institution:" labels
   - Email domain (e.g., @university.edu → "University")
   - Footer/signature university name
   - ANY university identifier

2. **Program Name** - Look for:
   - "Program:", "Course:", "Major:", "Field of Study:"
   - "You are admitted to [PROGRAM]"
   - "Offer for [PROGRAM]"
   - Near degree level

3. **Degree Level** - Determine from:
   - "Bachelor's", "Bachelor of", "BS", "BA" → bachelor
   - "Master's", "Master of", "MS", "MA", "MBA" → master
   - "PhD", "Doctorate", "Doctoral" → phd
   - "Diploma" → diploma
   - "Certificate" → certificate
   - Default to "other" if unclear

4. **Intake Information** - Look for:
   - "Intake:", "Semester:", "Term:", "Session:"
   - "Fall", "Spring", "Summer", "Winter"
   - Year (must be 2024 or later)
   - "Starting [DATE]"

5. **Location** - Look for:
   - Country name
   - City name
   - University address

6. **Duration** - Look for:
   - "Duration:", "Length:", "Program length:"
   - "2 years", "4 semesters", "18 months"

7. **Tuition Fee** - Look for:
   - "Tuition:", "Fees:", "Cost:", "Amount:"
   - Annual amount preferred
   - Currency (USD, GBP, EUR, CAD, AUD, INR, etc.)
   - Extract number only (e.g., "$25,000" → 25000)

8. **Scholarship** - Look for:
   - "Scholarship", "Financial Aid", "Grant", "Bursary"
   - Amount if mentioned
   - Set scholarship_mentioned: true if ANY scholarship is mentioned

9. **Deadlines** - Look for:
   - "Acceptance deadline:", "Reply by:", "Respond by:"
   - "Enrollment deadline:", "Registration deadline:"
   - "Fee payment deadline:", "Deposit deadline:"
   - Format as DD/MM/YYYY

10. **Student/Application ID** - Look for:
    - "Student ID:", "Application ID:", "Reference Number:"

11. **Conditional Admission** - Look for:
    - "Conditional offer", "Subject to", "Provided that"
    - List conditions if mentioned

12. **Documents Required** - Look for:
    - "Required documents:", "Submit:", "Provide:"
    - List of documents needed

IMPORTANT RULES:
- If you see ANYTHING that looks like a university name, extract it
- If you see ANY program name, extract it
- Intake year MUST be between 2024-2030
- Date format MUST be DD/MM/YYYY
- Return null only if truly nothing found
- Set extraction_confidence based on clarity:
  * 0.9-1.0: All critical fields clear and readable
  * 0.7-0.9: Most fields found, some unclear
  * 0.5-0.7: Minimal info, poor quality
  * <0.5: Almost nothing extracted

Extract ALL information you can find, even if incomplete.
"""
    
    def extract(self, image_path: str) -> Optional[AdmissionLetter]:
        """Extract admission letter from single image"""
        print(f"📊 Extracting admission letter data...")
        
        result = self.extract_structured(
            image_path=image_path,
            schema=AdmissionLetter,
            prompt=self.PROMPT,
            timeout=90
        )
        
        if result:
            print(f"  ✅ Extracted:")
            print(f"     University: {result.university_name or 'Not found'}")
            print(f"     Program: {result.program_name or 'Not found'}")
            print(f"     Degree: {result.degree_level}")
            print(f"     Intake: {result.intake_term or 'N/A'} {result.intake_year or 'N/A'}")
            print(f"     Country: {result.country or 'Not found'}")
            print(f"     Confidence: {result.extraction_confidence:.2f}")
        else:
            print(f"  ⚠️ Failed to extract from this document")
        
        return result
    
    def extract_multiple(self, image_paths: List[str]) -> List[AdmissionLetter]:
        """Extract from multiple images (multi-page PDFs)"""
        print(f"📚 Extracting admission data from {len(image_paths)} pages...")
        
        all_results = []
        skipped = 0
        
        for i, img_path in enumerate(image_paths):
            print(f"  Page {i+1}/{len(image_paths)}...")
            result = self.extract(img_path)
            
            if result and result.extraction_confidence >= 0.3:
                all_results.append(result)
            else:
                skipped += 1
                print(f"  ⭐ Skipped page {i+1} (low confidence or failed)")
            
            if skipped >= 3:
                print(f"  ⚠️ Too many failures ({skipped}), stopping extraction")
                break
        
        if not all_results:
            print("  ❌ No data extracted from any page")
            return []
        
        print(f"  ✅ Successfully extracted from {len(all_results)}/{len(image_paths)} pages")
        return all_results
