// Financial Document Cross-Verification Agent
import { BaseAgent } from '../../core/BaseAgent.js';
import { AI_MODELS } from '../../config/aiModels.js';

export class FinancialVerificationAgent {
  constructor() {
    this.verificationAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    this.verificationFallback = new BaseAgent(AI_MODELS.VERIFICATION_FALLBACK);
    
    console.log('💰 Financial Verification Agent initialized');
  }

  async verifyIncomeConsistency(salaryData, bankData, form16Data = null, itrData = null) {
    console.log('💰 Verifying income consistency across documents...');
    
    const prompt = `Cross-verify income information across multiple financial documents. Return ONLY valid JSON:

{
  "verified": true|false,
  "confidence": number (0-100),
  "incomeConsistency": {
    "consistent": true|false,
    "averageMonthlyIncome": number,
    "variance": number,
    "matchScore": number (0-100)
  },
  "documentsCrossCheck": {
    "salaryMatchesBank": true|false,
    "salaryMatchesForm16": true|false,
    "bankMatchesITR": true|false,
    "inconsistencies": ["array of mismatches"]
  },
  "credibilityScore": number (0-100),
  "redFlags": ["array of concerns"],
  "positiveIndicators": ["array of positive signs"],
  "recommendation": "approve|review|reject",
  "estimatedMonthlyIncome": number
}

Salary Slips Data:
${salaryData ? JSON.stringify(salaryData, null, 2) : 'Not provided'}

Bank Statement Data:
${bankData ? JSON.stringify(bankData, null, 2) : 'Not provided'}

Form 16 Data:
${form16Data ? JSON.stringify(form16Data, null, 2) : 'Not provided'}

ITR Data:
${itrData ? JSON.stringify(itrData, null, 2) : 'Not provided'}

VERIFICATION LOGIC:
1. Salary slips should match bank salary credits (within 10% variance)
2. Form 16 total should match ITR (within 5% variance)
3. Bank statement salary should match Form 16/12 (monthly average)
4. Look for consistent employment and income pattern
5. Flag any major discrepancies (>20% variance)

INCOME ESTIMATION:
- Use most reliable source (preferably bank statement)
- Cross-check with at least 2 sources for confidence
- Account for deductions (PF, tax, etc.)`;

    try {
      let response;
      try {
        response = await this.verificationAgent.invoke(prompt);
      } catch (error) {
        console.warn('⚠️ Primary verification failed, using fallback...');
        response = await this.verificationFallback.invoke(prompt);
      }

      const verification = this.verificationAgent.parseJSON(response.content);
      
      console.log(`✅ Financial verification complete: ${verification.verified ? 'VERIFIED' : 'NOT VERIFIED'}`);
      
      return verification;

    } catch (error) {
      console.error('❌ Financial verification failed:', error.message);
      
      return {
        verified: false,
        confidence: 0,
        recommendation: 'review',
        error: true,
        message: error.message,
      };
    }
  }
}
