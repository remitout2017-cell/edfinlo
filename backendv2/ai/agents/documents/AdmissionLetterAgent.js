// Admission Letter Agent using LangGraph
import { StateGraph, END } from '@langchain/langgraph';
import { BaseAgent } from '../../core/BaseAgent.js';
import { AI_MODELS } from '../../config/aiModels.js';

const ADMISSION_STATE_SCHEMA = {
  images: [],
  admissionData: null,
  extractionComplete: false,
  validationComplete: false,
  currentStep: '',
  errors: [],
  startTime: 0,
};

export class AdmissionLetterAgent {
  constructor() {
    this.extractionAgent = new BaseAgent(AI_MODELS.EXTRACTION_PRIMARY);
    this.extractionFallback = new BaseAgent(AI_MODELS.EXTRACTION_FALLBACK);
    this.verificationAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    
    this.graph = this.buildWorkflow();
    this.app = this.graph.compile();
    
    console.log('🎓 Admission Letter Agent initialized');
  }

  buildWorkflow() {
    const workflow = new StateGraph({
      channels: ADMISSION_STATE_SCHEMA,
    });

    workflow.addNode('extract_admission', (state) => this.extractAdmission(state));
    workflow.addNode('validate_details', (state) => this.validateDetails(state));
    workflow.addNode('verify_university', (state) => this.verifyUniversity(state));
    workflow.addNode('assess_loan_viability', (state) => this.assessLoanViability(state));
    workflow.addNode('generate_report', (state) => this.generateReport(state));

    workflow.setEntryPoint('extract_admission');

    workflow.addConditionalEdges(
      'extract_admission',
      (state) => state.extractionComplete ? 'validate' : 'end',
      {
        validate: 'validate_details',
        end: 'generate_report',
      }
    );

    workflow.addEdge('validate_details', 'verify_university');
    workflow.addEdge('verify_university', 'assess_loan_viability');
    workflow.addEdge('assess_loan_viability', 'generate_report');
    workflow.addEdge('generate_report', END);

    return workflow;
  }

  async extractAdmission(state) {
    console.log('📨 Extracting admission letter details...');
    
    const prompt = `Extract admission/offer letter details. Return ONLY valid JSON:

{
  "universityName": "string",
  "universityAddress": "string or null",
  "country": "string",
  "city": "string or null",
  "studentName": "string",
  "programName": "string",
  "degreeLevel": "Bachelor|Master|PhD|Diploma",
  "specialization": "string or null",
  "duration": "string (e.g., 2 years, 4 years)",
  "intakeTerm": "Fall|Spring|Summer|Winter",
  "intakeYear": number (4 digits),
  "startDate": "DD/MM/YYYY or null",
  "tuitionFee": {
    "amount": number or null,
    "currency": "USD|EUR|GBP|CAD|AUD|INR",
    "period": "annual|total|semester"
  },
  "scholarshipOffered": {
    "present": true|false,
    "amount": number or null,
    "currency": "string or null",
    "type": "merit|need-based|partial|full|null"
  },
  "deadlines": {
    "acceptanceDeadline": "DD/MM/YYYY or null",
    "feePaymentDeadline": "DD/MM/YYYY or null",
    "visaDocumentDeadline": "DD/MM/YYYY or null"
  },
  "documentsRequired": ["array of documents student needs to submit"],
  "letterDate": "DD/MM/YYYY or null",
  "referenceNumber": "string or null",
  "confidence": number (0-100)
}

RULES:
1. Extract EXACT university name as shown
2. Identify country from address or context
3. Extract tuition fee if mentioned (convert to annual if needed)
4. Identify scholarship ONLY if explicitly mentioned
5. Extract all deadlines mentioned
6. List all required documents
7. Program duration in years`;

    try {
      let response;
      try {
        response = await this.extractionAgent.invoke(prompt, state.images);
      } catch (error) {
        console.warn('⚠️ Primary extraction failed, using fallback...');
        response = await this.extractionFallback.invoke(prompt, state.images);
      }

      const admissionData = this.extractionAgent.parseJSON(response.content);
      
      return {
        ...state,
        admissionData,
        extractionComplete: true,
        currentStep: 'extraction_complete',
      };

    } catch (error) {
      console.error('❌ Admission extraction failed:', error.message);
      
      return {
        ...state,
        extractionComplete: false,
        errors: [...state.errors, { step: 'extraction', error: error.message }],
        currentStep: 'extraction_failed',
      };
    }
  }

  async validateDetails(state) {
    console.log('✅ Validating admission details...');
    
    const { admissionData } = state;
    
    const validations = {
      valid: true,
      issues: [],
    };

    // Validate intake year
    const currentYear = new Date().getFullYear();
    if (admissionData.intakeYear < currentYear - 1 || admissionData.intakeYear > currentYear + 3) {
      validations.valid = false;
      validations.issues.push(`Unusual intake year: ${admissionData.intakeYear}`);
    }

    // Validate required fields
    if (!admissionData.universityName) {
      validations.valid = false;
      validations.issues.push('Missing university name');
    }

    if (!admissionData.programName) {
      validations.valid = false;
      validations.issues.push('Missing program name');
    }

    if (!admissionData.country) {
      validations.issues.push('Missing country information');
    }

    // Validate tuition fee if present
    if (admissionData.tuitionFee?.amount && admissionData.tuitionFee.amount < 0) {
      validations.valid = false;
      validations.issues.push('Invalid tuition fee amount');
    }

    return {
      ...state,
      admissionData: {
        ...admissionData,
        validation: validations,
      },
      validationComplete: true,
      currentStep: 'validation_complete',
    };
  }

  async verifyUniversity(state) {
    console.log('🏫 Verifying university reputation and recognition...');
    
    const { admissionData } = state;
    
    const prompt = `Verify university and assess for education loan approval. Return ONLY valid JSON:

{
  "universityRecognized": true|false,
  "confidence": number (0-100),
  "universityType": "top-tier|recognized|questionable|unknown",
  "countryReputation": "excellent|good|fair|poor",
  "programViability": "strong|moderate|weak",
  "loanApprovalFactors": {
    "positiveFactors": ["array of positive aspects"],
    "concerns": ["array of concerns"],
    "nbfcPerspective": "highly-favorable|favorable|neutral|unfavorable"
  },
  "recommendation": "strongly-approve|approve|review|reject"
}

University: ${admissionData.universityName}
Country: ${admissionData.country}
Program: ${admissionData.programName}
Degree: ${admissionData.degreeLevel}

Assess:
1. Is this a recognized university in ${admissionData.country}?
2. Is the program legitimate and career-oriented?
3. Country's reputation for education
4. Employability prospects after graduation
5. Typical loan approval rates for this university`;

    try {
      const response = await this.verificationAgent.invoke(prompt);
      const verification = this.verificationAgent.parseJSON(response.content);
      
      return {
        ...state,
        admissionData: {
          ...admissionData,
          universityVerification: verification,
        },
        currentStep: 'university_verified',
      };

    } catch (error) {
      console.error('❌ University verification failed:', error.message);
      
      return {
        ...state,
        errors: [...state.errors, { step: 'university_verification', error: error.message }],
        currentStep: 'university_verification_failed',
      };
    }
  }

  async assessLoanViability(state) {
    console.log('💰 Assessing education loan viability...');
    
    const { admissionData } = state;
    
    // Calculate loan requirement
    const tuitionFeeAnnual = admissionData.tuitionFee?.amount || 0;
    const programDurationYears = parseInt(admissionData.duration) || 2;
    const totalTuitionFee = tuitionFeeAnnual * programDurationYears;
    const livingExpensesPerYear = 10000; // Estimate based on country
    const totalLoanRequired = totalTuitionFee + (livingExpensesPerYear * programDurationYears);

    // Subtract scholarship
    const scholarshipAmount = admissionData.scholarshipOffered?.present ? (admissionData.scholarshipOffered.amount || 0) : 0;
    const netLoanRequired = Math.max(totalLoanRequired - scholarshipAmount, 0);

    const loanAssessment = {
      estimatedLoanAmount: Math.round(netLoanRequired),
      currency: admissionData.tuitionFee?.currency || 'USD',
      breakdown: {
        totalTuition: totalTuitionFee,
        livingExpenses: livingExpensesPerYear * programDurationYears,
        scholarshipDeduction: scholarshipAmount,
      },
      loanViability: netLoanRequired > 0 && admissionData.universityVerification?.universityRecognized ? 'viable' : 'not-viable',
      repaymentProjection: {
        estimatedMonthlyEMI: Math.round(netLoanRequired / (programDurationYears * 12 + 60)), // Program + 5 years
        repaymentPeriod: `${programDurationYears + 5} years`,
      },
    };

    return {
      ...state,
      admissionData: {
        ...admissionData,
        loanAssessment,
      },
      currentStep: 'loan_viability_assessed',
    };
  }

  async generateReport(state) {
    console.log('📊 Generating admission letter report...');
    
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

  async processAdmissionLetter(images, options = {}) {
    const initialState = {
      ...ADMISSION_STATE_SCHEMA,
      images,
      startTime: Date.now(),
    };

    try {
      const result = await this.app.invoke(initialState);
      
      return {
        success: result.extractionComplete,
        admissionData: result.admissionData,
        metadata: result.metadata,
      };

    } catch (error) {
      console.error('❌ Admission letter workflow failed:', error);
      throw error;
    }
  }
}
