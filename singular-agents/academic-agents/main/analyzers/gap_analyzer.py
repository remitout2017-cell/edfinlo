from langchain_groq import ChatGroq
from schemas import GapAnalysis, Class10Marksheet, Class12Marksheet, GraduationMarksheet
from config import Config
from typing import Optional
import json


class GapAnalyzer:
    """Analyze education gaps using Groq"""

    def __init__(self):
        self.model = ChatGroq(
            model=Config.GROQ_MODEL,
            api_key=Config.GROQ_API_KEY,
            temperature=0.1
        )

    def analyze_gaps(self,
                     class_10: Optional[Class10Marksheet],
                     class_12: Optional[Class12Marksheet],
                     graduation: Optional[GraduationMarksheet]) -> Optional[GapAnalysis]:
        """
        Analyze education timeline for gaps
        Uses Groq for complex reasoning
        """
        print(f"\n🔍 Analyzing education gaps with Groq...")

        # Build context
        context = self._build_context(class_10, class_12, graduation)

        if not context:
            print("   ⚠️ Insufficient data for gap analysis")
            return None

        prompt = f"""
You are an education timeline analyzer. Analyze the following academic records for gaps:

{context}

Analyze:
1. Is there a gap between 10th and 12th? (Normal is 2 years)
2. Is there a gap between 12th and graduation start? (Normal is 0-1 year)
3. Are there any gaps during graduation? (Check semester years)

Rules:
- Gap of 1+ year is significant
- 10th to 12th should be exactly 2 years
- 12th to graduation should be 0-1 year
- Graduation duration should match degree (3 years for B.Tech/B.Sc, 4 years for B.E, etc.)

Return a detailed gap analysis in JSON format with structure:
{{
    "has_gaps": boolean,
    "total_gaps": number,
    "gaps": [
        {{
            "gap_type": "after_10th" or "after_12th" or "during_graduation",
            "gap_years": float,
            "from_education": "education before gap",
            "to_education": "education after gap",
            "is_significant": boolean,
            "explanation": "clear explanation"
        }}
    ],
    "overall_assessment": "summary of timeline",
    "timeline_consistent": boolean
}}

Be very accurate and calculate gaps precisely.
"""

        try:
            # Use structured output with Groq
            structured_llm = self.model.with_structured_output(GapAnalysis)
            result = structured_llm.invoke(prompt)

            if result:
                print(f"   ✅ Gap analysis complete")
                print(f"      Has gaps: {result.has_gaps}")
                print(f"      Total gaps: {result.total_gaps}")
                if result.has_gaps:
                    for gap in result.gaps:
                        print(f"      - {gap.gap_type}: {gap.gap_years} years ({gap.explanation})")

            return result

        except Exception as e:
            print(f"   ❌ Gap analysis failed: {str(e)[:200]}")
            return None

    def _build_context(self,
                       class_10: Optional[Class10Marksheet],
                       class_12: Optional[Class12Marksheet],
                       graduation: Optional[GraduationMarksheet]) -> str:
        """Build context string for Groq"""
        context_parts = []

        if class_10:
            # FIXED: Use universal_grade instead of converted_grade
            grade_display = class_10.universal_grade or class_10.grade or "N/A"
            context_parts.append(f"""
**10th Standard:**
- Board: {class_10.board_name}
- Year of Passing: {class_10.year_of_passing}
- Grade: {grade_display}
- Percentage: {class_10.normalized_percentage or class_10.percentage or 'N/A'}
""")

        if class_12:
            # Class 12 uses converted_grade ✓
            grade_display = class_12.converted_grade or class_12.grade or "N/A"
            context_parts.append(f"""
**12th Standard:**
- Board: {class_12.board_name}
- Year of Passing: {class_12.year_of_passing}
- Stream: {class_12.stream or 'Not specified'}
- Grade: {grade_display}
- Percentage: {class_12.percentage or 'N/A'}
""")

        if graduation:
            sem_info = "\n".join([
                f"  - {sem.semester_year}: Completed in {sem.year_of_completion or 'N/A'}"
                for sem in graduation.semesters
            ])

            # Graduation uses converted_grade ✓
            grade_display = graduation.converted_grade or "N/A"
            context_parts.append(f"""
**Graduation:**
- Institution: {graduation.institution_name}
- Degree: {graduation.degree} in {graduation.specialization or 'N/A'}
- Year of Passing: {graduation.year_of_passing}
- Duration: {graduation.duration_years or 'Not specified'} years
- Semesters:
{sem_info}
- Final Grade: {grade_display}
- Final CGPA: {graduation.final_cgpa or 'N/A'}
- Final Percentage: {graduation.final_percentage or 'N/A'}
""")

        return "\n".join(context_parts)