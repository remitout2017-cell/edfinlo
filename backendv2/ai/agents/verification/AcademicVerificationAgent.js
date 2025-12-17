// Academic Documents Cross-Verification Agent
import { BaseAgent } from '../../core/BaseAgent.js';
import { AI_MODELS } from '../../config/aiModels.js';

export class AcademicVerificationAgent {
  constructor() {
    this.verificationAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    this.verificationFallback = new BaseAgent(AI_MODELS.VERIFICATION_FALLBACK);
    
    console.log('🎓 Academic Verification Agent initialized');
  }

  async verifyAcademicProgression(class10Data, class12Data, ugData = null, pgData = null) {
    console.log('🎓 Verifying academic progression...');
    
    const prompt = `Verify academic progression and consistency across educational records. Return ONLY valid JSON:

{
  "verified": true|false,
  "confidence": number (0-100),
  "progressionConsistency": {
    "consistent": true|false,
    "timeline": "logical|questionable|invalid",
    "gapYears": number,
    "gapReasons": ["array of identified gaps"]
  },
  "nameConsistency": {
    "consistent": true|false,
    "variations": ["array of name variations"],
    "matchScore": number (0-100)
  },
  "performanceAnalysis": {
    "trend": "improving|consistent|declining",
    "class10Percentage": number,
    "class12Percentage": number,
    "ugPercentage": number,
    "pgPercentage": number,
    "overallPerformance": "excellent|good|average|poor"
  },
  "documentAuthenticity": {
    "class10Authentic": true|false,
    "class12Authentic": true|false,
    "ugAuthentic": true|false,
    "pgAuthentic": true|false,
    "concerns": ["array of authenticity concerns"]
  },
  "boardUniversityVerification": {
    "class10BoardRecognized": true|false,
    "class12BoardRecognized": true|false,
    "ugUniversityRecognized": true|false,
    "pgUniversityRecognized": true|false
  },
  "redFlags": ["array of serious concerns"],
  "positiveIndicators": ["array of good signs"],
  "recommendation": "approve|review|reject",
  "reasoning": "detailed explanation"
}

Class 10 Data:
${class10Data ? JSON.stringify(class10Data, null, 2) : 'Not provided'}

Class 12 Data:
${class12Data ? JSON.stringify(class12Data, null, 2) : 'Not provided'}

Undergraduate Data:
${ugData ? JSON.stringify(ugData, null, 2) : 'Not provided'}

Postgraduate Data:
${pgData ? JSON.stringify(pgData, null, 2) : 'Not provided'}

VERIFICATION RULES:
1. Timeline must be logical (Class 10 → 12 → UG → PG)
2. Years should progress naturally (Class 10: 2015, Class 12: 2017, UG: 2021, etc.)
3. Name should be consistent (allow minor variations)
4. Performance should be credible (no impossible scores)
5. Boards/Universities should be recognized in India
6. Gap years (if any) should be reasonable (<3 years between levels)

RECOGNIZED BOARDS:
- CBSE, ICSE, IB
- State Boards (Maharashtra, Karnataka, Tamil Nadu, etc.)

PERFORMANCE ASSESSMENT:
- Excellent: >80% throughout
- Good: 60-80%
- Average: 50-60%
- Poor: <50%

BE LENIENT ON:
- Minor name spelling differences
- 1-2 year gaps (common, acceptable)
- Different scoring systems (percentage vs CGPA)

BE STRICT ON:
- Timeline impossibilities (Class 12 before Class 10)
- Major name differences
- Unrecognized boards/universities
- Suspicious score patterns`;

    try {
      let response;
      try {
        response = await this.verificationAgent.invoke(prompt);
      } catch (error) {
        console.warn('⚠️ Primary verification failed, using fallback...');
        response = await this.verificationFallback.invoke(prompt);
      }

      const verification = this.verificationAgent.parseJSON(response.content);
      
      console.log(`✅ Academic verification complete: ${verification.verified ? 'VERIFIED' : 'NOT VERIFIED'}`);
      
      return verification;

    } catch (error) {
      console.error('❌ Academic verification failed:', error.message);
      
      return {
        verified: false,
        confidence: 0,
        recommendation: 'review',
        reasoning: `Verification service failed: ${error.message}`,
        error: true,
      };
    }
  }

  async verifyAgainstAdmission(academicData, admissionData) {
    console.log('🎓 Verifying academic records against admission letter...');
    
    const prompt = `Verify if academic qualifications meet admission requirements. Return ONLY valid JSON:

{
  "eligible": true|false,
  "confidence": number (0-100),
  "qualificationMatch": {
    "meetsMinimumRequirement": true|false,
    "requiredLevel": "string",
    "providedLevel": "string",
    "matchScore": number (0-100)
  },
  "academicStanding": {
    "sufficient": true|false,
    "minimumPercentage": number,
    "actualPercentage": number,
    "meetsThreshold": true|false
  },
  "concerns": ["array of concerns"],
  "recommendation": "approve|review|reject"
}

Academic Records:
${JSON.stringify(academicData, null, 2)}

Admission Letter:
${JSON.stringify(admissionData, null, 2)}

Check:
1. Does student have required educational level for the program?
2. Does academic performance meet university standards?
3. Is there progression to justify admission (e.g., BSc for MSc program)?`;

    try {
      const response = await this.verificationAgent.invoke(prompt);
      const verification = this.verificationAgent.parseJSON(response.content);
      
      return verification;

    } catch (error) {
      console.error('❌ Admission verification failed:', error.message);
      
      return {
        eligible: false,
        confidence: 0,
        recommendation: 'review',
        error: true,
      };
    }
  }
}
