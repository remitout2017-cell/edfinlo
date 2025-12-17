// Form 16 Agent using LangGraph
import { StateGraph, END } from '@langchain/langgraph';
import { BaseAgent } from '../../core/BaseAgent.js';
import { AI_MODELS } from '../../config/aiModels.js';

const FORM16_STATE_SCHEMA = {
  images: [],
  yearlyData: [],
  extractionComplete: false,
  currentStep: '',
  errors: [],
  startTime: 0,
};

export class Form16Agent {
  constructor() {
    this.extractionAgent = new BaseAgent(AI_MODELS.EXTRACTION_PRIMARY);
    this.extractionFallback = new BaseAgent(AI_MODELS.EXTRACTION_FALLBACK);
    this.verificationAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    
    this.graph = this.buildWorkflow();
    this.app = this.graph.compile();
    
    console.log('📄 Form 16 Agent initialized');
  }

  buildWorkflow() {
    const workflow = new StateGraph({
      channels: FORM16_STATE_SCHEMA,
    });

    workflow.addNode('extract_form16', (state) => this.extractForm16(state));
    workflow.addNode('validate_calculations', (state) => this.validateCalculations(state));
    workflow.addNode('cross_verify', (state) => this.crossVerify(state));
    workflow.addNode('generate_summary', (state) => this.generateSummary(state));

    workflow.setEntryPoint('extract_form16');

    workflow.addConditionalEdges(
      'extract_form16',
      (state) => state.extractionComplete ? 'validate' : 'end',
      {
        validate: 'validate_calculations',
        end: 'generate_summary',
      }
    );

    workflow.addEdge('validate_calculations', 'cross_verify');
    workflow.addEdge('cross_verify', 'generate_summary');
    workflow.addEdge('generate_summary', END);

    return workflow;
  }

  async extractForm16(state) {
    console.log('📋 Extracting Form 16 details...');
    
    const prompt = `Extract Form 16 tax details. Return ONLY valid JSON:

{
  "financialYear": "string (e.g., 2023-24)",
  "assessmentYear": "string (e.g., 2024-25)",
  "employerName": "string",
  "employerTAN": "string",
  "employerAddress": "string",
  "employeeName": "string",
  "employeePAN": "string",
  "grossSalary": number,
  "allowances": number,
  "perquisites": number,
  "totalSalary": number,
  "standardDeduction": number,
  "professionalTax": number,
  "incomeUnderHeadSalary": number,
  "deductions80C": number,
  "deductions80D": number,
  "deductions80E": number,
  "totalChapterVIADeductions": number,
  "totalIncome": number,
  "taxOnTotalIncome": number,
  "surcharge": number,
  "healthAndEducationCess": number,
  "totalTaxLiability": number,
  "taxDeducted": number,
  "confidence": number (0-100)
}

RULES:
1. Extract from both Part A and Part B
2. Verify calculations match
3. Validate PAN and TAN formats
4. All amounts in INR without currency symbols`;

    try {
      let response;
      try {
        response = await this.extractionAgent.invoke(prompt, state.images);
      } catch (error) {
        response = await this.extractionFallback.invoke(prompt, state.images);
      }

      const extracted = this.extractionAgent.parseJSON(response.content);
      
      return {
        ...state,
        yearlyData: Array.isArray(extracted) ? extracted : [extracted],
        extractionComplete: true,
        currentStep: 'extraction_complete',
      };

    } catch (error) {
      console.error('❌ Form 16 extraction failed:', error.message);
      
      return {
        ...state,
        extractionComplete: false,
        errors: [...state.errors, { step: 'extraction', error: error.message }],
        currentStep: 'extraction_failed',
      };
    }
  }

  async validateCalculations(state) {
    console.log('🧮 Validating Form 16 calculations...');
    
    const { yearlyData } = state;
    
    yearlyData.forEach(form => {
      const validations = [];
      
      // Validate: Total Income = Income Under Head Salary - Deductions
      const expectedTotalIncome = (form.incomeUnderHeadSalary || 0) - (form.totalChapterVIADeductions || 0);
      if (Math.abs(expectedTotalIncome - (form.totalIncome || 0)) > 10) {
        validations.push('Total income calculation mismatch');
      }
      
      // Validate: Total Tax = Tax + Surcharge + Cess
      const expectedTotalTax = (form.taxOnTotalIncome || 0) + (form.surcharge || 0) + (form.healthAndEducationCess || 0);
      if (Math.abs(expectedTotalTax - (form.totalTaxLiability || 0)) > 10) {
        validations.push('Total tax liability calculation mismatch');
      }
      
      form.validationIssues = validations;
      form.isValid = validations.length === 0;
    });

    return {
      ...state,
      yearlyData,
      currentStep: 'calculations_validated',
    };
  }

  async crossVerify(state) {
    console.log('🔍 Cross-verifying Form 16 data...');
    
    const { yearlyData } = state;
    
    const prompt = `Verify Form 16 authenticity and consistency. Return ONLY valid JSON:

{
  "authentic": true|false,
  "confidence": number (0-100),
  "issues": ["array of issues"],
  "recommendation": "approve|review|reject"
}

Form 16 Data:
${JSON.stringify(yearlyData, null, 2)}

Check:
1. PAN and TAN format validity
2. Calculation consistency
3. Deductions are within legal limits
4. Tax rates are correct for the year
5. All mandatory fields present`;

    try {
      const response = await this.verificationAgent.invoke(prompt);
      const verification = this.verificationAgent.parseJSON(response.content);
      
      return {
        ...state,
        yearlyData: yearlyData.map(form => ({
          ...form,
          verification,
        })),
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

  async generateSummary(state) {
    console.log('📊 Generating Form 16 summary...');
    
    const processingTime = Date.now() - state.startTime;
    
    return {
      ...state,
      currentStep: 'complete',
      metadata: {
        processingTime,
        yearsProcessed: state.yearlyData.length,
        extractionComplete: state.extractionComplete,
      },
    };
  }

  async processForm16(images, options = {}) {
    const initialState = {
      ...FORM16_STATE_SCHEMA,
      images,
      startTime: Date.now(),
    };

    try {
      const result = await this.app.invoke(initialState);
      
      return {
        success: result.extractionComplete,
        yearlyData: result.yearlyData,
        metadata: result.metadata,
      };

    } catch (error) {
      console.error('❌ Form 16 workflow failed:', error);
      throw error;
    }
  }
}
