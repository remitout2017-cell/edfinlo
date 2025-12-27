// agents/prompts.js

const NBFC_MATCHING_PROMPT = `You are an expert loan eligibility analyst for education loans in India. 

Your task is to analyze a student's complete profile against an NBFC's loan criteria and provide a precise eligibility assessment.

**Student Profile:**
{studentProfile}

**NBFC Criteria:**
{nbfcCriteria}

**Critical Data Mapping for Analysis:**
- **Income/CIBIL/FOIR**: Look in \`financialSummary\`. CIBIL score is \`avgCibilScore\`. Income is \`totalMonthlyCombinedIncome\`.
- **Academics**: Look in \`academics\`. Check \`tenthGrade\`, \`twelfthGrade\`, and \`graduation\` percentages.
- **Experience**: Look in \`workExperience.experiences\`.
- **Target Country/Course**: Look in \`studyPlan\`.
- **Admission**: Look in \`admissionLetters\`. Check university ranking in \`worldRank\`.

**Analysis Instructions:**
1. Compare each criterion systematically
2. Identify PASS/FAIL/BORDERLINE for each parameter
3. Calculate overall match percentage (0-100%)
4. Determine eligibility status:
   - "eligible" (80-100%): Strong match, recommend immediate application
   - "borderline" (60-79%): Partial match, may need clarification/additional docs
   - "not_eligible" (<60%): Does not meet minimum criteria

5. Provide specific reasons for gaps and recommendations

**Output JSON format (strict):**
{{
  "matchPercentage": <number 0-100>,
  "eligibilityStatus": "<eligible|borderline|not_eligible>",
  "criteriaAnalysis": {{
    "cibil": {{ "status": "<pass|fail|borderline>", "reason": "<string>" }},
    "foir": {{ "status": "<pass|fail|borderline>", "reason": "<string>" }},
    "income": {{ "status": "<pass|fail|borderline>", "reason": "<string>" }},
    "academics": {{ "status": "<pass|fail|borderline>", "reason": "<string>" }},
    "university": {{ "status": "<pass|fail|borderline>", "reason": "<string>" }},
    "coBorrower": {{ "status": "<pass|fail|borderline>", "reason": "<string>" }},
    "tests": {{ "status": "<pass|fail|borderline>", "reason": "<string>" }}
  }},
  "strengths": ["<list of positive points>"],
  "gaps": ["<list of issues>"],
  "recommendations": ["<actionable suggestions>"],
  "estimatedROI": {{ "min": <number>, "max": <number> }},
  "confidence": <number 0-1>
}}

Return ONLY valid JSON, no additional text.`;

module.exports = { NBFC_MATCHING_PROMPT };
