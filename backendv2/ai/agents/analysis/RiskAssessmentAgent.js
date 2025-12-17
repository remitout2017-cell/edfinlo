// Comprehensive Risk Assessment Agent
import { BaseAgent } from '../../core/BaseAgent.js';
import { AI_MODELS } from '../../config/aiModels.js';

export class RiskAssessmentAgent {
  constructor() {
    this.riskAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    
    console.log('⚠️ Risk Assessment Agent initialized');
  }

  async assessRisk(applicantData, loanDetails) {
    console.log('⚠️ Conducting comprehensive risk assessment...');
    
    const prompt = `Conduct comprehensive loan risk assessment. Return ONLY valid JSON:

{
  "riskScore": number (0-100, lower is better),
  "riskLevel": "very-low|low|medium|high|very-high",
  "riskCategory": "A|B|C|D|E",
  "defaultProbability": number (0-100),
  "creditRating": "AAA|AA|A|BBB|BB|B|CCC|CC|C|D",
  "riskFactors": {
    "identityRisk": {
      "score": number,
      "level": "low|medium|high",
      "factors": ["array"]
    },
    "incomeRisk": {
      "score": number,
      "level": "low|medium|high",
      "factors": ["array"]
    },
    "employmentRisk": {
      "score": number,
      "level": "low|medium|high",
      "factors": ["array"]
    },
    "financialBehaviorRisk": {
      "score": number,
      "level": "low|medium|high",
      "factors": ["array"]
    },
    "debtBurdenRisk": {
      "score": number,
      "level": "low|medium|high",
      "factors": ["array"]
    }
  },
  "redFlags": ["critical concerns"],
  "yellowFlags": ["moderate concerns"],
  "greenFlags": ["positive indicators"],
  "mitigationStrategies": ["ways to reduce risk"],
  "recommendation": {
    "decision": "approve|approve-with-conditions|reject",
    "conditions": ["array of conditions"],
    "reasoning": "detailed explanation"
  }
}

Applicant Data:
${JSON.stringify(applicantData, null, 2)}

Loan Details:
${JSON.stringify(loanDetails, null, 2)}

RISK ASSESSMENT FRAMEWORK:
1. Identity Risk: KYC verification, document authenticity
2. Income Risk: Income stability, source verification
3. Employment Risk: Job stability, tenure, employer reputation
4. Financial Behavior: Banking patterns, bounced payments, savings
5. Debt Burden: Existing EMIs, FOIR, repayment capacity

SCORING:
- 0-20: Very Low Risk (Category A, AAA-AA rating)
- 21-40: Low Risk (Category B, A-BBB rating)
- 41-60: Medium Risk (Category C, BB-B rating)
- 61-80: High Risk (Category D, CCC-CC rating)
- 81-100: Very High Risk (Category E, C-D rating)

Default Probability:
- Very Low: <5%
- Low: 5-15%
- Medium: 15-30%
- High: 30-50%
- Very High: >50%`;

    try {
      const response = await this.riskAgent.invoke(prompt);
      const riskAssessment = this.riskAgent.parseJSON(response.content);
      
      console.log(`✅ Risk assessment complete: ${riskAssessment.riskLevel} risk (Score: ${riskAssessment.riskScore})`);
      
      return riskAssessment;

    } catch (error) {
      console.error('❌ Risk assessment failed:', error.message);
      throw error;
    }
  }
}
