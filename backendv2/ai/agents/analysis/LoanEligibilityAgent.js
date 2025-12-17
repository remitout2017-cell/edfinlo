// Dedicated Loan Eligibility Analysis Agent
import { BaseAgent } from '../../core/BaseAgent.js';
import { AI_MODELS } from '../../config/aiModels.js';

export class LoanEligibilityAgent {
  constructor() {
    this.analysisAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    
    console.log('📊 Loan Eligibility Agent initialized');
  }

  async analyzeLoanEligibility(applicantData, loanType, requestedAmount) {
    console.log('📊 Analyzing loan eligibility...');
    
    const prompt = `Analyze loan eligibility comprehensively. Return ONLY valid JSON:

{
  "eligible": true|false,
  "eligibilityScore": number (0-100),
  "maxLoanAmount": number,
  "recommendedAmount": number,
  "tenure": {
    "minMonths": number,
    "maxMonths": number,
    "recommendedMonths": number
  },
  "interestRate": {
    "min": number,
    "max": number,
    "recommended": number
  },
  "emiCalculation": {
    "monthlyEMI": number,
    "totalInterest": number,
    "totalPayable": number
  },
  "foir": {
    "currentFOIR": number,
    "projectedFOIR": number,
    "acceptable": true|false
  },
  "eligibilityFactors": {
    "income": "strong|adequate|weak",
    "creditHistory": "excellent|good|fair|poor",
    "employment": "stable|moderate|unstable",
    "existingDebts": "low|moderate|high"
  },
  "strengths": ["array of positive factors"],
  "weaknesses": ["array of concerns"],
  "conditions": ["array of conditions for approval"],
  "recommendation": "approve|conditional-approve|reject"
}

Applicant Data:
${JSON.stringify(applicantData, null, 2)}

Loan Type: ${loanType}
Requested Amount: ₹${requestedAmount}

ELIGIBILITY CRITERIA:
1. Minimum monthly income: ₹25,000 for personal, ₹15,000 for education
2. FOIR (Fixed Obligation to Income Ratio) < 50%
3. Minimum employment: 6 months (salaried), 2 years (self-employed)
4. Age: 21-65 years
5. No major red flags in banking behavior

LOAN CALCULATION:
- Personal Loan: Up to 5x monthly income, max 5 years
- Education Loan: Up to program cost + living expenses, max 10 years
- Interest rates: 10-18% based on profile
- EMI should not exceed 40% of monthly income`;

    try {
      const response = await this.analysisAgent.invoke(prompt);
      const analysis = this.analysisAgent.parseJSON(response.content);
      
      console.log(`✅ Eligibility analysis complete: ${analysis.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}`);
      
      return analysis;

    } catch (error) {
      console.error('❌ Eligibility analysis failed:', error.message);
      throw error;
    }
  }
}
