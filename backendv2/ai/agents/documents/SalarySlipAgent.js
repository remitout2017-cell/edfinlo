// Salary Slip Agent using LangGraph
import { StateGraph, END } from '@langchain/langgraph';
import { BaseAgent } from '../../core/BaseAgent.js';
import { AI_MODELS } from '../../config/aiModels.js';

const SALARY_STATE_SCHEMA = {
  images: [],
  monthlyData: [],
  summary: null,
  extractionComplete: false,
  validationComplete: false,
  currentStep: '',
  errors: [],
  startTime: 0,
};

export class SalarySlipAgent {
  constructor() {
    this.extractionAgent = new BaseAgent(AI_MODELS.EXTRACTION_PRIMARY);
    this.extractionFallback = new BaseAgent(AI_MODELS.EXTRACTION_FALLBACK);
    this.verificationAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    
    this.graph = this.buildWorkflow();
    this.app = this.graph.compile();
    
    console.log('💰 Salary Slip Agent initialized');
  }

  buildWorkflow() {
    const workflow = new StateGraph({
      channels: SALARY_STATE_SCHEMA,
    });

    workflow.addNode('extract_monthly_slips', (state) => this.extractMonthlySlips(state));
    workflow.addNode('analyze_consistency', (state) => this.analyzeConsistency(state));
    workflow.addNode('calculate_averages', (state) => this.calculateAverages(state));
    workflow.addNode('verify_income', (state) => this.verifyIncome(state));
    workflow.addNode('generate_summary', (state) => this.generateSummary(state));

    workflow.setEntryPoint('extract_monthly_slips');

    workflow.addConditionalEdges(
      'extract_monthly_slips',
      (state) => state.extractionComplete ? 'analyze' : 'end',
      {
        analyze: 'analyze_consistency',
        end: 'generate_summary',
      }
    );

    workflow.addEdge('analyze_consistency', 'calculate_averages');
    workflow.addEdge('calculate_averages', 'verify_income');
    workflow.addEdge('verify_income', 'generate_summary');
    workflow.addEdge('generate_summary', END);

    return workflow;
  }

  async extractMonthlySlips(state) {
    console.log('💼 Extracting salary slip data...');
    
    const prompt = `Extract salary slip details from the provided image(s). Return ONLY valid JSON:

{
  "employerName": "string or null",
  "employeeName": "string or null",
  "employeeId": "string or null",
  "designation": "string or null",
  "month": "string (e.g., January, February) or null",
  "year": number (4 digits) or null",
  "paymentDate": "DD/MM/YYYY or null",
  "basicSalary": number or null,
  "hra": number or null,
  "conveyanceAllowance": number or null,
  "medicalAllowance": number or null,
  "specialAllowance": number or null,
  "otherAllowances": number or null,
  "grossSalary": number or null,
  "providentFund": number or null,
  "professionalTax": number or null,
  "incomeTax": number or null,
  "otherDeductions": number or null,
  "totalDeductions": number or null,
  "netSalary": number or null,
  "confidence": number (0-100)
}

RULES:
1. Extract all earnings components
2. Extract all deduction components
3. Verify: Net Salary = Gross Salary - Total Deductions
4. Use null for missing fields
5. All amounts should be numbers without currency symbols
6. Date format: DD/MM/YYYY`;

    try {
      let response;
      try {
        response = await this.extractionAgent.invoke(prompt, state.images);
      } catch (error) {
        console.warn('⚠️ Primary extraction failed, using fallback...');
        response = await this.extractionFallback.invoke(prompt, state.images);
      }

      const extracted = this.extractionAgent.parseJSON(response.content);
      
      return {
        ...state,
        monthlyData: Array.isArray(extracted) ? extracted : [extracted],
        extractionComplete: true,
        currentStep: 'extraction_complete',
      };

    } catch (error) {
      console.error('❌ Salary slip extraction failed:', error.message);
      
      return {
        ...state,
        extractionComplete: false,
        errors: [...state.errors, { step: 'extraction', error: error.message }],
        currentStep: 'extraction_failed',
      };
    }
  }

  async analyzeConsistency(state) {
    console.log('📊 Analyzing salary consistency...');
    
    const { monthlyData } = state;
    
    if (monthlyData.length < 2) {
      return {
        ...state,
        currentStep: 'consistency_skipped',
      };
    }

    // Calculate variance in net salary
    const netSalaries = monthlyData.map(m => m.netSalary).filter(Boolean);
    const avgSalary = netSalaries.reduce((a, b) => a + b, 0) / netSalaries.length;
    
    monthlyData.forEach(slip => {
      if (slip.netSalary) {
        const variance = Math.abs((slip.netSalary - avgSalary) / avgSalary);
        slip.isConsistent = variance < 0.15; // 15% threshold
        slip.variance = variance;
      }
    });

    return {
      ...state,
      monthlyData,
      currentStep: 'consistency_analyzed',
    };
  }

  async calculateAverages(state) {
    console.log('🧮 Calculating salary averages...');
    
    const { monthlyData } = state;
    
    const summary = {
      monthsAnalyzed: monthlyData.length,
      averageGrossSalary: 0,
      averageNetSalary: 0,
      averageDeductions: 0,
      consistencyRate: 0,
      employerName: monthlyData[0]?.employerName,
      employeeName: monthlyData[0]?.employeeName,
      designation: monthlyData[0]?.designation,
    };

    const grossSalaries = monthlyData.map(m => m.grossSalary).filter(Boolean);
    const netSalaries = monthlyData.map(m => m.netSalary).filter(Boolean);
    const deductions = monthlyData.map(m => m.totalDeductions).filter(Boolean);
    
    if (grossSalaries.length > 0) {
      summary.averageGrossSalary = Math.round(grossSalaries.reduce((a, b) => a + b, 0) / grossSalaries.length);
    }
    
    if (netSalaries.length > 0) {
      summary.averageNetSalary = Math.round(netSalaries.reduce((a, b) => a + b, 0) / netSalaries.length);
    }
    
    if (deductions.length > 0) {
      summary.averageDeductions = Math.round(deductions.reduce((a, b) => a + b, 0) / deductions.length);
    }

    const consistentMonths = monthlyData.filter(m => m.isConsistent).length;
    summary.consistencyRate = (consistentMonths / monthlyData.length * 100).toFixed(1);

    return {
      ...state,
      summary,
      currentStep: 'averages_calculated',
    };
  }

  async verifyIncome(state) {
    console.log('✅ Verifying income stability...');
    
    const { summary } = state;
    
    const prompt = `Verify salary slip data for income stability. Return ONLY valid JSON:

{
  "incomeStable": true|false,
  "confidence": number (0-100),
  "employmentVerified": true|false,
  "issues": ["array of issues"],
  "recommendation": "approve|review|reject"
}

Salary Data:
${JSON.stringify(summary, null, 2)}

Check:
1. Consistent salary across months (variance < 20%)
2. Valid employer and employee details
3. Proper salary structure (basic, HRA, etc.)
4. Deductions are reasonable`;

    try {
      const response = await this.verificationAgent.invoke(prompt);
      const verification = this.verificationAgent.parseJSON(response.content);
      
      return {
        ...state,
        summary: {
          ...summary,
          verification,
        },
        validationComplete: true,
        currentStep: 'verification_complete',
      };

    } catch (error) {
      console.error('❌ Verification failed:', error.message);
      
      return {
        ...state,
        validationComplete: false,
        errors: [...state.errors, { step: 'verification', error: error.message }],
        currentStep: 'verification_failed',
      };
    }
  }

  async generateSummary(state) {
    console.log('📋 Generating salary summary...');
    
    const processingTime = Date.now() - state.startTime;
    
    return {
      ...state,
      currentStep: 'complete',
      metadata: {
        processingTime,
        monthsProcessed: state.monthlyData.length,
        extractionComplete: state.extractionComplete,
        validationComplete: state.validationComplete,
      },
    };
  }

  async processSalarySlips(images, options = {}) {
    const initialState = {
      ...SALARY_STATE_SCHEMA,
      images,
      startTime: Date.now(),
    };

    try {
      const result = await this.app.invoke(initialState);
      
      return {
        success: result.extractionComplete,
        monthlyData: result.monthlyData,
        summary: result.summary,
        metadata: result.metadata,
      };

    } catch (error) {
      console.error('❌ Salary slip workflow failed:', error);
      throw error;
    }
  }
}
