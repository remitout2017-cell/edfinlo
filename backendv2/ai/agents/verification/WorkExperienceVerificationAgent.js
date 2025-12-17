// Work Experience Cross-Verification Agent
import { BaseAgent } from '../../core/BaseAgent.js';
import { AI_MODELS } from '../../config/aiModels.js';

export class WorkExperienceVerificationAgent {
  constructor() {
    this.verificationAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    this.verificationFallback = new BaseAgent(AI_MODELS.VERIFICATION_FALLBACK);
    
    console.log('💼 Work Experience Verification Agent initialized');
  }

  async verifyEmploymentHistory(workExperiences, salaryData = null, bankData = null) {
    console.log('💼 Verifying employment history...');
    
    const prompt = `Verify employment history for authenticity and consistency. Return ONLY valid JSON:

{
  "verified": true|false,
  "confidence": number (0-100),
  "employmentConsistency": {
    "consistent": true|false,
    "timeline": "logical|questionable|invalid",
    "gaps": [
      {
        "from": "DD/MM/YYYY",
        "to": "DD/MM/YYYY",
        "durationMonths": number,
        "acceptable": true|false
      }
    ],
    "overlaps": [
      {
        "companies": ["array of overlapping companies"],
        "period": "string",
        "acceptable": true|false
      }
    ]
  },
  "careerProgression": {
    "logical": true|false,
    "trend": "upward|lateral|downward|erratic",
    "designationProgression": ["array of designations in order"],
    "industryConsistency": "consistent|varied|random"
  },
  "salaryProgression": {
    "logical": true|false,
    "trend": "increasing|stable|decreasing|erratic",
    "growthRate": "healthy|average|stagnant|suspicious",
    "matchesMarketStandards": true|false
  },
  "documentCompleteness": {
    "hasOfferLetters": true|false,
    "hasExperienceLetters": true|false,
    "hasRelievingLetters": true|false,
    "hasSalarySlips": true|false,
    "completeness": "complete|partial|minimal"
  },
  "crossVerification": {
    "salaryMatchesSlips": true|false,
    "salaryMatchesBank": true|false,
    "employmentDatesMatch": true|false,
    "inconsistencies": ["array of mismatches"]
  },
  "redFlags": ["array of serious concerns"],
  "yellowFlags": ["array of moderate concerns"],
  "greenFlags": ["array of positive indicators"],
  "recommendation": "approve|review|reject",
  "reasoning": "detailed explanation"
}

Work Experience Data:
${JSON.stringify(workExperiences, null, 2)}

Salary Slips Data:
${salaryData ? JSON.stringify(salaryData, null, 2) : 'Not provided'}

Bank Statement Data:
${bankData ? JSON.stringify(bankData, null, 2) : 'Not provided'}

VERIFICATION RULES:
1. Timeline must be logical (no time travel, no impossible overlaps)
2. Career progression should make sense (junior → senior positions)
3. Salary should progress or at least stay stable
4. Employment gaps > 6 months should be noted (not necessarily red flag)
5. Frequent job changes (< 1 year per job) = concern
6. Document authenticity (letterheads, signatures, formats)

ACCEPTABLE PATTERNS:
- 1-3 month gaps between jobs (normal)
- Lateral moves (same level, different company)
- Career switches (with explanation)
- Sabbaticals (if reasonable duration)

RED FLAGS:
- Overlapping full-time positions (impossible)
- Major salary decreases without explanation
- Too frequent changes (>5 companies in 3 years)
- Inconsistent information across documents
- Suspiciously high salary jumps (>100% increase)

CROSS-VERIFICATION:
- Salary slips should match work experience dates
- Bank credits should align with salary slip amounts
- Company names should be consistent across all documents
- Designation should match across offer/experience letters

BE LENIENT ON:
- Minor date mismatches (1-2 days difference)
- Company name variations (Pvt Ltd vs Private Limited)
- Designation title variations (Software Engineer vs Software Developer)
- 1-2 month employment gaps

BE STRICT ON:
- Major timeline inconsistencies (6+ months)
- Salary mismatches (>20% difference)
- Missing critical documents (no proof for claimed experience)
- Suspicious patterns (too good to be true progression)`;

    try {
      let response;
      try {
        response = await this.verificationAgent.invoke(prompt);
      } catch (error) {
        console.warn('⚠️ Primary verification failed, using fallback...');
        response = await this.verificationFallback.invoke(prompt);
      }

      const verification = this.verificationAgent.parseJSON(response.content);
      
      console.log(`✅ Employment verification complete: ${verification.verified ? 'VERIFIED' : 'NOT VERIFIED'}`);
      
      return verification;

    } catch (error) {
      console.error('❌ Employment verification failed:', error.message);
      
      return {
        verified: false,
        confidence: 0,
        recommendation: 'review',
        reasoning: `Verification service failed: ${error.message}`,
        error: true,
      };
    }
  }

  async verifyCurrentEmployment(workExperience, salarySlips, bankStatement) {
    console.log('💼 Verifying current employment status...');
    
    const prompt = `Verify current employment status specifically. Return ONLY valid JSON:

{
  "currentlyEmployed": true|false,
  "confidence": number (0-100),
  "employmentProof": {
    "hasRecentSalarySlips": true|false,
    "lastSalarySlipDate": "DD/MM/YYYY",
    "monthsOld": number,
    "bankCreditsMatch": true|false,
    "lastBankCreditDate": "DD/MM/YYYY"
  },
  "employmentStability": {
    "stable": true|false,
    "currentTenure": "string (e.g., 2 years 3 months)",
    "tenureMonths": number,
    "stabilitylevel": "high|medium|low"
  },
  "recommendation": "confirmed|likely|uncertain|not-employed"
}

Work Experience:
${JSON.stringify(workExperience, null, 2)}

Recent Salary Slips:
${JSON.stringify(salarySlips, null, 2)}

Bank Statement:
${JSON.stringify(bankStatement, null, 2)}

Check:
1. Are salary slips recent (within last 3 months)?
2. Are bank salary credits recent and regular?
3. Does work experience show ongoing employment?
4. Is there consistency across all sources?`;

    try {
      const response = await this.verificationAgent.invoke(prompt);
      const verification = this.verificationAgent.parseJSON(response.content);
      
      return verification;

    } catch (error) {
      console.error('❌ Current employment verification failed:', error.message);
      
      return {
        currentlyEmployed: false,
        confidence: 0,
        recommendation: 'uncertain',
        error: true,
      };
    }
  }
}
