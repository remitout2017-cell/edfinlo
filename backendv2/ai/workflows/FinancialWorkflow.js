// Specialized Financial Documents Workflow
import { StateGraph, END } from '@langchain/langgraph';
import { SalarySlipAgent } from '../agents/documents/SalarySlipAgent.js';
import { BankStatementAgent } from '../agents/documents/BankStatementAgent.js';
import { Form16Agent } from '../agents/documents/Form16Agent.js';
import { ITRAgent } from '../agents/documents/ITRAgent.js';
import { FinancialVerificationAgent } from '../agents/verification/FinancialVerificationAgent.js';

const FINANCIAL_WORKFLOW_STATE = {
  documents: {
    salarySlips: [],
    bankStatements: [],
    form16: [],
    itr: [],
  },
  results: {
    salary: null,
    bank: null,
    form16: null,
    itr: null,
  },
  verification: null,
  financialSummary: null,
  currentStep: '',
  errors: [],
  startTime: 0,
};

export class FinancialWorkflow {
  constructor() {
    this.salaryAgent = new SalarySlipAgent();
    this.bankAgent = new BankStatementAgent();
    this.form16Agent = new Form16Agent();
    this.itrAgent = new ITRAgent();
    this.verificationAgent = new FinancialVerificationAgent();
    
    this.graph = this.buildWorkflow();
    this.app = this.graph.compile();
    
    console.log('💰 Financial Workflow initialized');
  }

  buildWorkflow() {
    const workflow = new StateGraph({
      channels: FINANCIAL_WORKFLOW_STATE,
    });

    workflow.addNode('process_all_documents', (state) => this.processAllDocuments(state));
    workflow.addNode('verify_income', (state) => this.verifyIncome(state));
    workflow.addNode('calculate_financial_health', (state) => this.calculateFinancialHealth(state));
    workflow.addNode('generate_financial_report', (state) => this.generateReport(state));

    workflow.setEntryPoint('process_all_documents');

    workflow.addEdge('process_all_documents', 'verify_income');
    workflow.addEdge('verify_income', 'calculate_financial_health');
    workflow.addEdge('calculate_financial_health', 'generate_financial_report');
    workflow.addEdge('generate_financial_report', END);

    return workflow;
  }

  async processAllDocuments(state) {
    console.log('📄 Processing all financial documents in parallel...');
    
    const results = {};
    const errors = [];

    // Process all documents in parallel
    const promises = [];

    if (state.documents.salarySlips.length > 0) {
      promises.push(
        this.salaryAgent.processSalarySlips(state.documents.salarySlips)
          .then(result => { results.salary = result; })
          .catch(error => { errors.push({ doc: 'salary', error: error.message }); })
      );
    }

    if (state.documents.bankStatements.length > 0) {
      promises.push(
        this.bankAgent.processBankStatement(state.documents.bankStatements)
          .then(result => { results.bank = result; })
          .catch(error => { errors.push({ doc: 'bank', error: error.message }); })
      );
    }

    if (state.documents.form16.length > 0) {
      promises.push(
        this.form16Agent.processForm16(state.documents.form16)
          .then(result => { results.form16 = result; })
          .catch(error => { errors.push({ doc: 'form16', error: error.message }); })
      );
    }

    if (state.documents.itr.length > 0) {
      promises.push(
        this.itrAgent.processITR(state.documents.itr)
          .then(result => { results.itr = result; })
          .catch(error => { errors.push({ doc: 'itr', error: error.message }); })
      );
    }

    await Promise.allSettled(promises);

    return {
      ...state,
      results,
      errors: [...state.errors, ...errors],
      currentStep: 'documents_processed',
    };
  }

  async verifyIncome(state) {
    console.log('🔍 Verifying income consistency...');
    
    try {
      const verification = await this.verificationAgent.verifyIncomeConsistency(
        state.results.salary,
        state.results.bank,
        state.results.form16,
        state.results.itr
      );
      
      return {
        ...state,
        verification,
        currentStep: 'income_verified',
      };

    } catch (error) {
      return {
        ...state,
        errors: [...state.errors, { step: 'verification', error: error.message }],
        currentStep: 'verification_failed',
      };
    }
  }

  async calculateFinancialHealth(state) {
    console.log('💪 Calculating financial health...');
    
    const { results, verification } = state;
    
    // Calculate monthly income from multiple sources
    const incomeEstimates = [];
    
    if (results.salary?.summary?.averageNetSalary) {
      incomeEstimates.push(results.salary.summary.averageNetSalary);
    }
    
    if (results.bank?.overallAnalysis?.salaryConsistency?.averageAmount) {
      incomeEstimates.push(results.bank.overallAnalysis.salaryConsistency.averageAmount);
    }
    
    if (results.form16?.yearlyData?.[0]?.totalSalary) {
      incomeEstimates.push(results.form16.yearlyData[0].totalSalary / 12);
    }
    
    if (results.itr?.itrData?.incomeDetails?.totalIncome) {
      incomeEstimates.push(results.itr.itrData.incomeDetails.totalIncome / 12);
    }

    const monthlyIncome = incomeEstimates.length > 0
      ? Math.round(incomeEstimates.reduce((a, b) => a + b, 0) / incomeEstimates.length)
      : 0;

    // Calculate debt obligations
    const monthlyEMI = results.bank?.overallAnalysis?.emiObligations?.totalMonthlyEMI || 0;
    
    // Calculate FOIR
    const foir = monthlyIncome > 0 ? (monthlyEMI / monthlyIncome) * 100 : 0;

    // Calculate savings rate
    const avgBalance = results.bank?.overallAnalysis?.cashFlow?.avgBalance || 0;
    const savingsRate = results.bank?.overallAnalysis?.cashFlow?.savingsRate || 0;

    const financialSummary = {
      monthlyIncome,
      monthlyEMI,
      foir: Math.round(foir * 10) / 10,
      disposableIncome: monthlyIncome - monthlyEMI,
      avgBalance,
      savingsRate,
      financialHealth: foir < 40 ? 'excellent' : foir < 50 ? 'good' : 'concerning',
      incomeStability: verification?.incomeConsistency?.consistent ? 'stable' : 'unstable',
      loanCapacity: Math.round((monthlyIncome * 0.5 - monthlyEMI) * 60), // 5 years
    };

    return {
      ...state,
      financialSummary,
      currentStep: 'health_calculated',
    };
  }

  async generateReport(state) {
    console.log('📊 Generating financial report...');
    
    const processingTime = Date.now() - state.startTime;
    
    return {
      ...state,
      currentStep: 'complete',
      metadata: {
        processingTime,
        documentsProcessed: {
          salary: !!state.results.salary,
          bank: !!state.results.bank,
          form16: !!state.results.form16,
          itr: !!state.results.itr,
        },
      },
    };
  }

  async processFinancials(documents) {
    const initialState = {
      ...FINANCIAL_WORKFLOW_STATE,
      documents,
      startTime: Date.now(),
    };

    try {
      const result = await this.app.invoke(initialState);
      
      return {
        success: true,
        results: result.results,
        verification: result.verification,
        financialSummary: result.financialSummary,
        metadata: result.metadata,
        errors: result.errors,
      };

    } catch (error) {
      console.error('❌ Financial workflow failed:', error);
      throw error;
    }
  }
}
