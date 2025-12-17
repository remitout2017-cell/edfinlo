// Specialized KYC Workflow
import { StateGraph, END } from '@langchain/langgraph';
import { KYCAgent } from '../agents/documents/KYCAgent.js';
import { KYCVerificationAgent } from '../agents/verification/KYCVerificationAgent.js';

const KYC_WORKFLOW_STATE = {
  images: [],
  extractedData: null,
  verification: null,
  governmentVerification: null,
  finalResult: null,
  currentStep: '',
  errors: [],
  startTime: 0,
};

export class KYCWorkflow {
  constructor() {
    this.kycAgent = new KYCAgent();
    this.verificationAgent = new KYCVerificationAgent();
    
    this.graph = this.buildWorkflow();
    this.app = this.graph.compile();
    
    console.log('🪪 KYC Workflow initialized');
  }

  buildWorkflow() {
    const workflow = new StateGraph({
      channels: KYC_WORKFLOW_STATE,
    });

    workflow.addNode('extract_kyc', (state) => this.extractKYC(state));
    workflow.addNode('verify_cross_documents', (state) => this.verifyCrossDocuments(state));
    workflow.addNode('verify_government', (state) => this.verifyGovernment(state));
    workflow.addNode('generate_kyc_report', (state) => this.generateReport(state));

    workflow.setEntryPoint('extract_kyc');

    workflow.addConditionalEdges(
      'extract_kyc',
      (state) => state.extractedData ? 'verify' : 'report',
      {
        verify: 'verify_cross_documents',
        report: 'generate_kyc_report',
      }
    );

    workflow.addEdge('verify_cross_documents', 'verify_government');
    workflow.addEdge('verify_government', 'generate_kyc_report');
    workflow.addEdge('generate_kyc_report', END);

    return workflow;
  }

  async extractKYC(state) {
    console.log('📄 Step 1: Extracting KYC documents...');
    
    try {
      const result = await this.kycAgent.processKYC(state.images);
      
      return {
        ...state,
        extractedData: result,
        currentStep: 'extraction_complete',
      };

    } catch (error) {
      return {
        ...state,
        errors: [...state.errors, { step: 'extraction', error: error.message }],
        currentStep: 'extraction_failed',
      };
    }
  }

  async verifyCrossDocuments(state) {
    console.log('🔍 Step 2: Cross-verifying documents...');
    
    try {
      const { aadhaar, pan, passport } = state.extractedData;
      
      const verification = await this.verificationAgent.verifyCrossDocuments(
        aadhaar,
        pan,
        passport
      );
      
      return {
        ...state,
        verification,
        currentStep: 'verification_complete',
      };

    } catch (error) {
      return {
        ...state,
        errors: [...state.errors, { step: 'verification', error: error.message }],
        currentStep: 'verification_failed',
      };
    }
  }

  async verifyGovernment(state) {
    console.log('🏛️ Step 3: Government database verification...');
    
    try {
      const { aadhaar, pan } = state.extractedData;
      
      const govVerification = await this.verificationAgent.verifyWithGovernmentDB(
        pan?.panNumber,
        aadhaar?.aadhaarNumber
      );
      
      return {
        ...state,
        governmentVerification: govVerification,
        currentStep: 'gov_verification_complete',
      };

    } catch (error) {
      return {
        ...state,
        errors: [...state.errors, { step: 'gov_verification', error: error.message }],
        currentStep: 'gov_verification_failed',
      };
    }
  }

  async generateReport(state) {
    console.log('📊 Step 4: Generating KYC report...');
    
    const processingTime = Date.now() - state.startTime;
    
    const finalResult = {
      success: state.extractedData && state.verification,
      kycVerified: state.verification?.verified || false,
      extractedData: state.extractedData,
      verification: state.verification,
      governmentVerification: state.governmentVerification,
      processingTime,
      timestamp: new Date().toISOString(),
    };

    return {
      ...state,
      finalResult,
      currentStep: 'complete',
    };
  }

  async processKYC(images) {
    const initialState = {
      ...KYC_WORKFLOW_STATE,
      images,
      startTime: Date.now(),
    };

    try {
      const result = await this.app.invoke(initialState);
      return result.finalResult;

    } catch (error) {
      console.error('❌ KYC workflow failed:', error);
      throw error;
    }
  }
}
