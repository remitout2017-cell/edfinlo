// ITR (Income Tax Return) Agent using LangGraph
import { StateGraph, END } from '@langchain/langgraph';
import { BaseAgent } from '../../core/BaseAgent.js';
import { AI_MODELS } from '../../config/aiModels.js';

const ITR_STATE_SCHEMA = {
  images: [],
  itrData: null,
  extractionComplete: false,
  validationComplete: false,
  currentStep: '',
  errors: [],
  startTime: 0,
};

export class ITRAgent {
  constructor() {
    this.extractionAgent = new BaseAgent(AI_MODELS.EXTRACTION_PRIMARY);
    this.extractionFallback = new BaseAgent(AI_MODELS.EXTRACTION_FALLBACK);
    this.verificationAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    
    this.graph = this.buildWorkflow();
    this.app = this.graph.compile();
    
    console.log('📊 ITR Agent initialized');
  }

  buildWorkflow() {
    const workflow = new StateGraph({
      channels: ITR_STATE_SCHEMA,
    });

    workflow.addNode('extract_itr', (state) => this.extractITR(state));
    workflow.addNode('validate_income_sources', (state) => this.validateIncomeSources(state));
    workflow.addNode('verify_authenticity', (state) => this.verifyAuthenticity(state));
    workflow.addNode('assess_creditworthiness', (state) => this.assessCreditworthiness(state));
    workflow.addNode('generate_report', (state) => this.generateReport(state));

    workflow.setEntryPoint('extract_itr');

    workflow.addConditionalEdges(
      'extract_itr',
      (state) => state.extractionComplete ? 'validate' : 'end',
      {
        validate: 'validate_income_sources',
        end: 'generate_report',
      }
    );

    workflow.addEdge('validate_income_sources', 'verify_authenticity');
    workflow.addEdge('verify_authenticity', 'assess_creditworthiness');
    workflow.addEdge('assess_creditworthiness', 'generate_report');
    workflow.addEdge('generate_report', END);

    return workflow;
  }

  async extractITR(state) {
    console.log('📋 Extracting ITR details...');
    
    const prompt = `Extract Income Tax Return (ITR) details. Return ONLY valid JSON:

{
  "assessmentYear": "string (e.g., 2023-24)",
  "itrForm": "ITR-1|ITR-2|ITR-3|ITR-4",
  "filingDate": "DD/MM/YYYY",
  "acknowledgementNumber": "string",
  "taxpayerName": "string",
  "pan": "string",
  "dateOfBirth": "DD/MM/YYYY",
  "residentialStatus": "Resident|Non-Resident|RNOR",
  "incomeDetails": {
    "salaryIncome": number,
    "housePropertyIncome": number,
    "businessIncome": number,
    "capitalGains": number,
    "otherSources": number,
    "totalIncome": number
  },
  "deductions": {
    "section80C": number,
    "section80D": number,
    "section80E": number,
    "section80G": number,
    "totalDeductions": number
  },
  "taxDetails": {
    "totalIncome": number,
    "taxPayable": number,
    "taxPaid": {
      "tds": number,
      "advanceTax": number,
      "selfAssessmentTax": number,
      "total": number
    },
    "refundDue": number
  },
  "verification": {
    "method": "EVC|Aadhaar OTP|Net Banking|DSC",
    "verifiedOn": "DD/MM/YYYY"
  },
  "confidence": number (0-100)
}

RULES:
1. Extract ALL income sources
2. Extract ALL deductions claimed
3. Verify acknowledgement number format
4. Validate PAN format
5. Check if ITR is verified
6. Extract refund or tax due amount`;

    try {
      let response;
      try {
        response = await this.extractionAgent.invoke(prompt, state.images);
      } catch (error) {
        console.warn('⚠️ Primary extraction failed, using fallback...');
        response = await this.extractionFallback.invoke(prompt, state.images);
      }

      const itrData = this.extractionAgent.parseJSON(response.content);
      
      return {
        ...state,
        itrData,
        extractionComplete: true,
        currentStep: 'extraction_complete',
      };

    } catch (error) {
      console.error('❌ ITR extraction failed:', error.message);
      
      return {
        ...state,
        extractionComplete: false,
        errors: [...state.errors, { step: 'extraction', error: error.message }],
        currentStep: 'extraction_failed',
      };
    }
  }

  async validateIncomeSources(state) {
    console.log('💰 Validating income sources...');
    
    const { itrData } = state;
    
    const validations = {
      valid: true,
      issues: [],
    };

    // Validate total income calculation
    const incomeSum = Object.values(itrData.incomeDetails || {})
      .filter(val => typeof val === 'number')
      .reduce((sum, val) => sum + val, 0) - (itrData.incomeDetails?.totalIncome || 0);
    
    if (Math.abs(incomeSum) > 1000) {
      validations.valid = false;
      validations.issues.push('Total income calculation mismatch');
    }

    // Validate deductions
    const deductionSum = Object.values(itrData.deductions || {})
      .filter(val => typeof val === 'number')
      .reduce((sum, val) => sum + val, 0) - (itrData.deductions?.totalDeductions || 0);
    
    if (Math.abs(deductionSum) > 1000) {
      validations.valid = false;
      validations.issues.push('Total deductions calculation mismatch');
    }

    // Validate tax calculations
    const totalTaxPaid = Object.values(itrData.taxDetails?.taxPaid || {})
      .filter(val => typeof val === 'number')
      .reduce((sum, val) => sum + val, 0) - (itrData.taxDetails?.taxPaid?.total || 0);
    
    if (Math.abs(totalTaxPaid) > 1000) {
      validations.valid = false;
      validations.issues.push('Total tax paid calculation mismatch');
    }

    // PAN validation
    const panRegex = /^[A-Z]{5}\d{4}[A-Z]{1}$/;
    if (itrData.pan && !panRegex.test(itrData.pan)) {
      validations.valid = false;
      validations.issues.push('Invalid PAN format');
    }

    return {
      ...state,
      itrData: {
        ...itrData,
        validation: validations,
      },
      validationComplete: true,
      currentStep: 'validation_complete',
    };
  }

  async verifyAuthenticity(state) {
    console.log('🔐 Verifying ITR authenticity...');
    
    const { itrData } = state;
    
    const prompt = `Verify ITR authenticity and consistency. Return ONLY valid JSON:

{
  "authentic": true|false,
  "verified": true|false,
  "confidence": number (0-100),
  "redFlags": ["array of concerns"],
  "positiveIndicators": ["array of positive signs"],
  "recommendation": "approve|review|reject"
}

ITR Data:
${JSON.stringify(itrData, null, 2)}

Check:
1. ITR is verified (EVC/Aadhaar/DSC)
2. Acknowledgement number is present
3. Income sources are realistic
4. Deductions are within legal limits
5. Tax calculations are correct
6. All mandatory fields present
7. No suspicious patterns`;

    try {
      const response = await this.verificationAgent.invoke(prompt);
      const verification = this.verificationAgent.parseJSON(response.content);
      
      return {
        ...state,
        itrData: {
          ...itrData,
          verification: {
            ...itrData.verification,
            ...verification,
          },
        },
        currentStep: 'verification_complete',
      };

    } catch (error) {
      console.error('❌ Verification failed:', error.message);
      
      return {
        ...state,
        errors: [...state.errors, { step: 'verification', error: error.message }],
        currentStep: 'verification_failed',
      };
    }
  }

  async assessCreditworthiness(state) {
    console.log('📈 Assessing creditworthiness from ITR...');
    
    const { itrData } = state;
    
    const totalIncome = itrData.incomeDetails?.totalIncome || 0;
    const salaryIncome = itrData.incomeDetails?.salaryIncome || 0;
    const businessIncome = itrData.incomeDetails?.businessIncome || 0;
    
    const assessment = {
      incomeCategory: totalIncome > 1000000 ? 'high' : totalIncome > 500000 ? 'medium' : 'low',
      primaryIncomeSource: salaryIncome > businessIncome ? 'salaried' : 'business',
      taxCompliance: itrData.verification?.verified ? 'compliant' : 'non-compliant',
      estimatedMonthlyIncome: Math.round(totalIncome / 12),
      loanEligibility: {
        eligible: totalIncome >= 300000 && itrData.verification?.verified,
        estimatedAmount: Math.round(totalIncome * 5), // 5x annual income
        reason: totalIncome < 300000 ? 'Income below threshold' : !itrData.verification?.verified ? 'ITR not verified' : 'Eligible',
      },
    };

    return {
      ...state,
      itrData: {
        ...itrData,
        creditAssessment: assessment,
      },
      currentStep: 'assessment_complete',
    };
  }

  async generateReport(state) {
    console.log('📋 Generating ITR report...');
    
    const processingTime = Date.now() - state.startTime;
    
    return {
      ...state,
      currentStep: 'complete',
      metadata: {
        processingTime,
        extractionComplete: state.extractionComplete,
        validationComplete: state.validationComplete,
      },
    };
  }

  async processITR(images, options = {}) {
    const initialState = {
      ...ITR_STATE_SCHEMA,
      images,
      startTime: Date.now(),
    };

    try {
      const result = await this.app.invoke(initialState);
      
      return {
        success: result.extractionComplete,
        itrData: result.itrData,
        metadata: result.metadata,
      };

    } catch (error) {
      console.error('❌ ITR workflow failed:', error);
      throw error;
    }
  }
}
