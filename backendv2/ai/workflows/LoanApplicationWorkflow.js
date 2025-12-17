// Master Loan Application Workflow - Orchestrates ALL document agents
import { StateGraph, END } from '@langchain/langgraph';
import { KYCAgent } from '../agents/documents/KYCAgent.js';
import { SalarySlipAgent } from '../agents/documents/SalarySlipAgent.js';
import { BankStatementAgent } from '../agents/documents/BankStatementAgent.js';
import { Form16Agent } from '../agents/documents/Form16Agent.js';
import { ITRAgent } from '../agents/documents/ITRAgent.js';
import { AcademicRecordsAgent } from '../agents/documents/AcademicRecordsAgent.js';
import { AdmissionLetterAgent } from '../agents/documents/AdmissionLetterAgent.js';
import { WorkExperienceAgent } from '../agents/documents/WorkExperienceAgent.js';

const LOAN_APPLICATION_STATE_SCHEMA = {
  // Application metadata
  applicationId: '',
  applicantId: '',
  loanType: '', // 'education' or 'personal'
  
  // Document inputs
  documents: {
    kyc: [],
    salarySlips: [],
    bankStatements: [],
    form16: [],
    itr: [],
    workExperience: [],
    academics: {
      class10: [],
      class12: [],
      undergraduate: [],
      postgraduate: [],
    },
    admissionLetter: [],
  },
  
  // Processing results
  results: {
    kyc: null,
    salary: null,
    bankStatement: null,
    form16: null,
    itr: null,
    workExperience: null,
    academics: null,
    admission: null,
  },
  
  // Overall assessment
  loanEligibility: null,
  riskAssessment: null,
  finalRecommendation: null,
  
  // Workflow state
  currentStep: '',
  completedSteps: [],
  errors: [],
  startTime: 0,
  processingTime: 0,
};

export class LoanApplicationWorkflow {
  constructor() {
    // Initialize all agents
    this.kycAgent = new KYCAgent();
    this.salaryAgent = new SalarySlipAgent();
    this.bankAgent = new BankStatementAgent();
    this.form16Agent = new Form16Agent();
    this.itrAgent = new ITRAgent();
    this.workAgent = new WorkExperienceAgent();
    this.academicAgent = new AcademicRecordsAgent();
    this.admissionAgent = new AdmissionLetterAgent();
    
    // Build workflow graph
    this.graph = this.buildMasterWorkflow();
    this.app = this.graph.compile();
    
    console.log('🏦 Master Loan Application Workflow initialized');
  }

  buildMasterWorkflow() {
    const workflow = new StateGraph({
      channels: LOAN_APPLICATION_STATE_SCHEMA,
    });

    // Phase 1: Identity Verification (KYC)
    workflow.addNode('process_kyc', (state) => this.processKYC(state));
    
    // Phase 2: Financial Documents (parallel processing)
    workflow.addNode('process_financial_docs', (state) => this.processFinancialDocs(state));
    
    // Phase 3: Employment Verification
    workflow.addNode('process_employment', (state) => this.processEmployment(state));
    
    // Phase 4: Academic & Admission (for education loans)
    workflow.addNode('process_education_docs', (state) => this.processEducationDocs(state));
    
    // Phase 5: Loan Eligibility Assessment
    workflow.addNode('assess_eligibility', (state) => this.assessEligibility(state));
    
    // Phase 6: Risk Assessment
    workflow.addNode('assess_risk', (state) => this.assessRisk(state));
    
    // Phase 7: Final Recommendation
    workflow.addNode('generate_recommendation', (state) => this.generateRecommendation(state));
    
    workflow.addNode('handle_failure', (state) => this.handleFailure(state));

    // Set entry point
    workflow.setEntryPoint('process_kyc');

    // Define workflow edges
    workflow.addConditionalEdges(
      'process_kyc',
      (state) => this.routeAfterKYC(state),
      {
        success: 'process_financial_docs',
        failure: 'handle_failure',
      }
    );

    workflow.addConditionalEdges(
      'process_financial_docs',
      (state) => state.results.salary || state.results.bankStatement ? 'employment' : 'education',
      {
        employment: 'process_employment',
        education: 'process_education_docs',
      }
    );

    workflow.addConditionalEdges(
      'process_employment',
      (state) => state.loanType === 'education' ? 'education' : 'eligibility',
      {
        education: 'process_education_docs',
        eligibility: 'assess_eligibility',
      }
    );

    workflow.addConditionalEdges(
      'process_education_docs',
      (state) => state.loanType === 'education' && !state.results.admission ? 'failure' : 'eligibility',
      {
        eligibility: 'assess_eligibility',
        failure: 'handle_failure',
      }
    );

    workflow.addEdge('assess_eligibility', 'assess_risk');
    workflow.addEdge('assess_risk', 'generate_recommendation');
    workflow.addEdge('generate_recommendation', END);
    workflow.addEdge('handle_failure', END);

    return workflow;
  }

  // Phase 1: KYC Processing
  async processKYC(state) {
    console.log('🪪 Phase 1: Processing KYC documents...');
    
    if (!state.documents.kyc || state.documents.kyc.length === 0) {
      return {
        ...state,
        errors: [...state.errors, { phase: 'kyc', error: 'No KYC documents provided' }],
        currentStep: 'kyc_failed',
      };
    }

    try {
      const kycResult = await this.kycAgent.processKYC(state.documents.kyc);
      
      return {
        ...state,
        results: {
          ...state.results,
          kyc: kycResult,
        },
        completedSteps: [...state.completedSteps, 'kyc'],
        currentStep: 'kyc_complete',
      };

    } catch (error) {
      console.error('❌ KYC processing failed:', error.message);
      
      return {
        ...state,
        errors: [...state.errors, { phase: 'kyc', error: error.message }],
        currentStep: 'kyc_failed',
      };
    }
  }

  // Phase 2: Financial Documents Processing
  async processFinancialDocs(state) {
    console.log('💰 Phase 2: Processing financial documents...');
    
    const results = { ...state.results };
    const errors = [...state.errors];
    const completedSteps = [...state.completedSteps];

    // Process Salary Slips (if provided)
    if (state.documents.salarySlips && state.documents.salarySlips.length > 0) {
      try {
        console.log('💼 Processing salary slips...');
        const salaryResult = await this.salaryAgent.processSalarySlips(state.documents.salarySlips);
        results.salary = salaryResult;
        completedSteps.push('salary');
      } catch (error) {
        console.error('❌ Salary slip processing failed:', error.message);
        errors.push({ phase: 'salary', error: error.message });
      }
    }

    // Process Bank Statements (if provided)
    if (state.documents.bankStatements && state.documents.bankStatements.length > 0) {
      try {
        console.log('🏦 Processing bank statements...');
        const bankResult = await this.bankAgent.processBankStatement(state.documents.bankStatements);
        results.bankStatement = bankResult;
        completedSteps.push('bank_statement');
      } catch (error) {
        console.error('❌ Bank statement processing failed:', error.message);
        errors.push({ phase: 'bank_statement', error: error.message });
      }
    }

    // Process Form 16 (if provided)
    if (state.documents.form16 && state.documents.form16.length > 0) {
      try {
        console.log('📄 Processing Form 16...');
        const form16Result = await this.form16Agent.processForm16(state.documents.form16);
        results.form16 = form16Result;
        completedSteps.push('form16');
      } catch (error) {
        console.error('❌ Form 16 processing failed:', error.message);
        errors.push({ phase: 'form16', error: error.message });
      }
    }

    // Process ITR (if provided)
    if (state.documents.itr && state.documents.itr.length > 0) {
      try {
        console.log('📊 Processing ITR...');
        const itrResult = await this.itrAgent.processITR(state.documents.itr);
        results.itr = itrResult;
        completedSteps.push('itr');
      } catch (error) {
        console.error('❌ ITR processing failed:', error.message);
        errors.push({ phase: 'itr', error: error.message });
      }
    }

    return {
      ...state,
      results,
      errors,
      completedSteps,
      currentStep: 'financial_docs_complete',
    };
  }

  // Phase 3: Employment Processing
  async processEmployment(state) {
    console.log('💼 Phase 3: Processing employment documents...');
    
    if (!state.documents.workExperience || state.documents.workExperience.length === 0) {
      console.log('⚠️ No work experience documents provided, skipping...');
      return {
        ...state,
        completedSteps: [...state.completedSteps, 'employment_skipped'],
        currentStep: 'employment_skipped',
      };
    }

    try {
      const workResult = await this.workAgent.processWorkExperience(state.documents.workExperience);
      
      return {
        ...state,
        results: {
          ...state.results,
          workExperience: workResult,
        },
        completedSteps: [...state.completedSteps, 'employment'],
        currentStep: 'employment_complete',
      };

    } catch (error) {
      console.error('❌ Employment processing failed:', error.message);
      
      return {
        ...state,
        errors: [...state.errors, { phase: 'employment', error: error.message }],
        currentStep: 'employment_failed',
      };
    }
  }

  // Phase 4: Education Documents Processing (for education loans)
  async processEducationDocs(state) {
    console.log('🎓 Phase 4: Processing education documents...');
    
    if (state.loanType !== 'education') {
      console.log('⚠️ Not an education loan, skipping academic docs...');
      return {
        ...state,
        completedSteps: [...state.completedSteps, 'education_skipped'],
        currentStep: 'education_skipped',
      };
    }

    const results = { ...state.results };
    const errors = [...state.errors];
    const completedSteps = [...state.completedSteps];

    // Initialize academic results
    results.academics = {};

    // Process Class 10
    if (state.documents.academics.class10 && state.documents.academics.class10.length > 0) {
      try {
        console.log('📚 Processing Class 10 marksheet...');
        const class10Result = await this.academicAgent.processAcademicRecords(
          state.documents.academics.class10,
          'class10'
        );
        results.academics.class10 = class10Result;
        completedSteps.push('class10');
      } catch (error) {
        console.error('❌ Class 10 processing failed:', error.message);
        errors.push({ phase: 'class10', error: error.message });
      }
    }

    // Process Class 12
    if (state.documents.academics.class12 && state.documents.academics.class12.length > 0) {
      try {
        console.log('📚 Processing Class 12 marksheet...');
        const class12Result = await this.academicAgent.processAcademicRecords(
          state.documents.academics.class12,
          'class12'
        );
        results.academics.class12 = class12Result;
        completedSteps.push('class12');
      } catch (error) {
        console.error('❌ Class 12 processing failed:', error.message);
        errors.push({ phase: 'class12', error: error.message });
      }
    }

    // Process Undergraduate
    if (state.documents.academics.undergraduate && state.documents.academics.undergraduate.length > 0) {
      try {
        console.log('📚 Processing Undergraduate records...');
        const ugResult = await this.academicAgent.processAcademicRecords(
          state.documents.academics.undergraduate,
          'undergraduate'
        );
        results.academics.undergraduate = ugResult;
        completedSteps.push('undergraduate');
      } catch (error) {
        console.error('❌ Undergraduate processing failed:', error.message);
        errors.push({ phase: 'undergraduate', error: error.message });
      }
    }

    // Process Postgraduate
    if (state.documents.academics.postgraduate && state.documents.academics.postgraduate.length > 0) {
      try {
        console.log('📚 Processing Postgraduate records...');
        const pgResult = await this.academicAgent.processAcademicRecords(
          state.documents.academics.postgraduate,
          'postgraduate'
        );
        results.academics.postgraduate = pgResult;
        completedSteps.push('postgraduate');
      } catch (error) {
        console.error('❌ Postgraduate processing failed:', error.message);
        errors.push({ phase: 'postgraduate', error: error.message });
      }
    }

    // Process Admission Letter (MANDATORY for education loans)
    if (state.documents.admissionLetter && state.documents.admissionLetter.length > 0) {
      try {
        console.log('🎓 Processing Admission Letter...');
        const admissionResult = await this.admissionAgent.processAdmissionLetter(
          state.documents.admissionLetter
        );
        results.admission = admissionResult;
        completedSteps.push('admission');
      } catch (error) {
        console.error('❌ Admission letter processing failed:', error.message);
        errors.push({ phase: 'admission', error: error.message });
      }
    } else {
      errors.push({ phase: 'admission', error: 'Admission letter is mandatory for education loans' });
    }

    return {
      ...state,
      results,
      errors,
      completedSteps,
      currentStep: 'education_docs_complete',
    };
  }

  // Phase 5: Loan Eligibility Assessment
  async assessEligibility(state) {
    console.log('📊 Phase 5: Assessing loan eligibility...');
    
    const { results, loanType } = state;
    
    let eligibilityScore = 0;
    let eligibilityFactors = [];
    let requiredDocuments = [];
    let missingDocuments = [];

    // KYC Check (Mandatory - 20 points)
    if (results.kyc && results.kyc.success && results.kyc.verification?.verified) {
      eligibilityScore += 20;
      eligibilityFactors.push('✅ KYC documents verified');
    } else {
      missingDocuments.push('Valid KYC documents');
      eligibilityFactors.push('❌ KYC verification failed');
    }

    // Income Verification (30 points)
    let incomeVerified = false;
    let monthlyIncome = 0;

    if (results.salary && results.salary.success) {
      const avgSalary = results.salary.summary?.averageNetSalary || 0;
      if (avgSalary > 0) {
        eligibilityScore += 15;
        incomeVerified = true;
        monthlyIncome = avgSalary;
        eligibilityFactors.push(`✅ Salary verified: ₹${avgSalary.toLocaleString()}/month`);
      }
    }

    if (results.bankStatement && results.bankStatement.success) {
      const salaryConsistency = results.bankStatement.overallAnalysis?.salaryConsistency;
      if (salaryConsistency?.present) {
        eligibilityScore += 15;
        incomeVerified = true;
        monthlyIncome = Math.max(monthlyIncome, salaryConsistency.averageAmount || 0);
        eligibilityFactors.push('✅ Bank statement confirms regular salary');
      }
    }

    if (!incomeVerified) {
      missingDocuments.push('Income proof (Salary slips or Bank statement)');
      eligibilityFactors.push('❌ Income not verified');
    }

    // Tax Compliance (15 points)
    if (results.itr && results.itr.success && results.itr.itrData?.verification?.verified) {
      eligibilityScore += 15;
      eligibilityFactors.push('✅ ITR filed and verified');
    } else if (results.form16 && results.form16.success) {
      eligibilityScore += 10;
      eligibilityFactors.push('✅ Form 16 provided');
    } else {
      eligibilityFactors.push('⚠️ No tax documents provided');
    }

    // Employment Stability (15 points)
    if (results.workExperience && results.workExperience.success) {
      const stability = results.workExperience.stabilityAssessment?.stabilityScore || 0;
      const experienceMonths = results.workExperience.experienceSummary?.totalMonths || 0;
      
      if (stability >= 70 && experienceMonths >= 12) {
        eligibilityScore += 15;
        eligibilityFactors.push('✅ Strong employment stability');
      } else if (stability >= 50 && experienceMonths >= 6) {
        eligibilityScore += 10;
        eligibilityFactors.push('✅ Acceptable employment history');
      } else {
        eligibilityScore += 5;
        eligibilityFactors.push('⚠️ Limited employment history');
      }
    } else {
      eligibilityFactors.push('⚠️ No employment documents provided');
    }

    // Financial Health (20 points)
    if (results.bankStatement && results.bankStatement.success) {
      const assessment = results.bankStatement.overallAnalysis?.assessment;
      const avgBalance = results.bankStatement.overallAnalysis?.cashFlow?.avgBalance || 0;
      
      if (assessment?.loanEligibility?.eligibleAmount > 0 && avgBalance > 10000) {
        eligibilityScore += 20;
        eligibilityFactors.push('✅ Strong financial health');
      } else if (avgBalance > 5000) {
        eligibilityScore += 10;
        eligibilityFactors.push('✅ Adequate financial health');
      } else {
        eligibilityScore += 5;
        eligibilityFactors.push('⚠️ Weak financial position');
      }
    }

    // Education-specific checks
    if (loanType === 'education') {
      // Admission Letter (Mandatory)
      if (results.admission && results.admission.success) {
        const universityVerified = results.admission.admissionData?.universityVerification?.universityRecognized;
        if (universityVerified) {
          eligibilityFactors.push('✅ University recognized for education loan');
        } else {
          eligibilityFactors.push('❌ University not recognized');
          eligibilityScore -= 20;
        }
      } else {
        missingDocuments.push('Valid Admission Letter');
        eligibilityFactors.push('❌ Admission letter missing/invalid');
        eligibilityScore -= 30;
      }

      // Academic Records (Recommended)
      const hasAcademics = results.academics && (
        results.academics.class10 || 
        results.academics.class12 || 
        results.academics.undergraduate
      );
      
      if (hasAcademics) {
        eligibilityFactors.push('✅ Academic records provided');
      } else {
        eligibilityFactors.push('⚠️ Academic records missing (recommended)');
      }
    }

    // Calculate eligible loan amount
    let eligibleAmount = 0;
    if (monthlyIncome > 0) {
      // FOIR-based calculation
      const emiObligations = results.bankStatement?.overallAnalysis?.emiObligations?.totalMonthlyEMI || 0;
      const availableIncome = monthlyIncome * 0.5 - emiObligations; // 50% FOIR
      
      if (loanType === 'education') {
        // Education loan: Up to 10x monthly income (typical range)
        eligibleAmount = Math.max(0, monthlyIncome * 10);
      } else {
        // Personal loan: EMI-based calculation (5 years tenure)
        eligibleAmount = Math.max(0, availableIncome * 60); // 60 months
      }
    }

    const eligibility = {
      eligible: eligibilityScore >= 60 && incomeVerified && results.kyc?.success,
      eligibilityScore: Math.min(100, eligibilityScore),
      eligibilityLevel: eligibilityScore >= 80 ? 'high' : eligibilityScore >= 60 ? 'medium' : 'low',
      eligibleAmount: Math.round(eligibleAmount),
      monthlyIncome,
      eligibilityFactors,
      requiredDocuments,
      missingDocuments,
      recommendation: eligibilityScore >= 80 ? 'Pre-approved' : 
                      eligibilityScore >= 60 ? 'Review & Process' : 
                      'Additional documents required',
    };

    return {
      ...state,
      loanEligibility: eligibility,
      currentStep: 'eligibility_assessed',
    };
  }

  // Phase 6: Risk Assessment
  async assessRisk(state) {
    console.log('⚠️ Phase 6: Assessing risk...');
    
    const { results, loanEligibility } = state;
    
    let riskScore = 100; // Start with 100 (low risk), subtract for issues
    let riskFactors = [];
    let redFlags = [];

    // KYC Risk
    if (results.kyc?.verification?.verified) {
      riskFactors.push('✅ Identity verified');
    } else {
      riskScore -= 30;
      redFlags.push('KYC verification failed');
    }

    // Income Stability Risk
    if (results.salary) {
      const consistency = results.salary.summary?.consistencyRate || 0;
      if (consistency >= 80) {
        riskFactors.push('✅ Consistent salary pattern');
      } else {
        riskScore -= 15;
        riskFactors.push('⚠️ Irregular salary pattern');
      }
    }

    // Banking Behavior Risk
    if (results.bankStatement) {
      const bounced = results.bankStatement.monthlyAnalysis?.some(m => m.bouncedTransactions > 0);
      const avgBalance = results.bankStatement.overallAnalysis?.cashFlow?.avgBalance || 0;
      
      if (bounced) {
        riskScore -= 20;
        redFlags.push('Bounced transactions detected');
      }
      
      if (avgBalance < 5000) {
        riskScore -= 10;
        riskFactors.push('⚠️ Low average balance');
      } else {
        riskFactors.push('✅ Healthy average balance');
      }
    }

    // Employment Risk
    if (results.workExperience) {
      const stabilityLevel = results.workExperience.stabilityAssessment?.stabilityLevel;
      if (stabilityLevel === 'high') {
        riskFactors.push('✅ Stable employment history');
      } else if (stabilityLevel === 'low') {
        riskScore -= 15;
        riskFactors.push('⚠️ Frequent job changes');
      }
    }

    // Debt Burden Risk
    if (results.bankStatement) {
      const totalEMI = results.bankStatement.overallAnalysis?.emiObligations?.totalMonthlyEMI || 0;
      const monthlyIncome = loanEligibility?.monthlyIncome || 0;
      
      if (monthlyIncome > 0) {
        const debtRatio = (totalEMI / monthlyIncome) * 100;
        if (debtRatio > 50) {
          riskScore -= 25;
          redFlags.push(`High debt burden: ${debtRatio.toFixed(1)}% FOIR`);
        } else if (debtRatio > 40) {
          riskScore -= 10;
          riskFactors.push(`⚠️ Moderate debt burden: ${debtRatio.toFixed(1)}% FOIR`);
        } else {
          riskFactors.push(`✅ Low debt burden: ${debtRatio.toFixed(1)}% FOIR`);
        }
      }
    }

    // Tax Compliance Risk
    if (!results.itr && !results.form16) {
      riskScore -= 10;
      riskFactors.push('⚠️ No tax documents provided');
    }

    // Education Loan Specific Risk
    if (state.loanType === 'education' && results.admission) {
      const universityType = results.admission.admissionData?.universityVerification?.universityType;
      if (universityType === 'questionable') {
        riskScore -= 30;
        redFlags.push('University reputation questionable');
      } else if (universityType === 'top-tier' || universityType === 'recognized') {
        riskFactors.push('✅ Recognized university');
      }
    }

    riskScore = Math.max(0, Math.min(100, riskScore));

    const riskAssessment = {
      riskScore,
      riskLevel: riskScore >= 70 ? 'low' : riskScore >= 50 ? 'medium' : 'high',
      riskFactors,
      redFlags,
      approvable: riskScore >= 50 && redFlags.length === 0,
      recommendation: riskScore >= 70 ? 'Low risk - Approve' : 
                      riskScore >= 50 ? 'Medium risk - Manual review' : 
                      'High risk - Reject or request additional documents',
    };

    return {
      ...state,
      riskAssessment,
      currentStep: 'risk_assessed',
    };
  }

  // Phase 7: Final Recommendation
  async generateRecommendation(state) {
    console.log('📋 Phase 7: Generating final recommendation...');
    
    const { loanEligibility, riskAssessment, loanType, results } = state;
    
    // Determine final decision
    let decision = 'PENDING';
    let confidence = 0;
    let reasons = [];
    let conditions = [];
    let nextSteps = [];

    if (!loanEligibility || !riskAssessment) {
      decision = 'INCOMPLETE';
      reasons.push('Assessment incomplete');
      nextSteps.push('Complete all required document submissions');
    } else {
      const eligibilityScore = loanEligibility.eligibilityScore;
      const riskScore = riskAssessment.riskScore;
      
      // Combined scoring
      const combinedScore = (eligibilityScore * 0.6) + (riskScore * 0.4);
      confidence = Math.round(combinedScore);

      if (combinedScore >= 75 && loanEligibility.eligible && riskAssessment.approvable) {
        decision = 'APPROVED';
        reasons.push('Strong eligibility and low risk profile');
        reasons.push(`Eligible amount: ₹${loanEligibility.eligibleAmount.toLocaleString()}`);
        nextSteps.push('Proceed to loan agreement and disbursement');
        
        if (riskScore < 80) {
          conditions.push('Subject to final verification of employment');
        }
      } else if (combinedScore >= 60 && loanEligibility.eligible) {
        decision = 'REVIEW';
        reasons.push('Moderate eligibility - requires manual review');
        reasons.push(`Eligible amount: ₹${loanEligibility.eligibleAmount.toLocaleString()}`);
        nextSteps.push('Manual underwriting review required');
        nextSteps.push('May need co-applicant or collateral');
        
        if (loanEligibility.missingDocuments.length > 0) {
          conditions.push(`Missing documents: ${loanEligibility.missingDocuments.join(', ')}`);
        }
      } else {
        decision = 'REJECTED';
        reasons.push('Does not meet minimum eligibility criteria');
        
        if (riskAssessment.redFlags.length > 0) {
          reasons.push(`Red flags: ${riskAssessment.redFlags.join(', ')}`);
        }
        
        if (loanEligibility.missingDocuments.length > 0) {
          nextSteps.push('Submit missing required documents and reapply');
          nextSteps.push(`Missing: ${loanEligibility.missingDocuments.join(', ')}`);
        } else {
          nextSteps.push('Improve financial profile and reapply after 3 months');
        }
      }
    }

    // Generate detailed report
    const finalRecommendation = {
      decision,
      confidence,
      reasons,
      conditions,
      nextSteps,
      eligibilitySummary: {
        score: loanEligibility?.eligibilityScore || 0,
        eligible: loanEligibility?.eligible || false,
        eligibleAmount: loanEligibility?.eligibleAmount || 0,
        monthlyIncome: loanEligibility?.monthlyIncome || 0,
      },
      riskSummary: {
        score: riskAssessment?.riskScore || 0,
        level: riskAssessment?.riskLevel || 'unknown',
        approvable: riskAssessment?.approvable || false,
      },
      documentsProcessed: {
        kyc: !!results.kyc?.success,
        salary: !!results.salary?.success,
        bankStatement: !!results.bankStatement?.success,
        form16: !!results.form16?.success,
        itr: !!results.itr?.success,
        workExperience: !!results.workExperience?.success,
        academics: !!(results.academics && Object.keys(results.academics).length > 0),
        admission: !!results.admission?.success,
      },
      loanType,
      timestamp: new Date().toISOString(),
    };

    const processingTime = Date.now() - state.startTime;

    return {
      ...state,
      finalRecommendation,
      processingTime,
      currentStep: 'complete',
    };
  }

  // Failure Handler
  async handleFailure(state) {
    console.error('❌ Loan application workflow failed');
    
    const processingTime = Date.now() - state.startTime;
    
    return {
      ...state,
      finalRecommendation: {
        decision: 'FAILED',
        confidence: 0,
        reasons: state.errors.map(e => `${e.phase}: ${e.error}`),
        conditions: [],
        nextSteps: ['Fix errors and resubmit application'],
      },
      processingTime,
      currentStep: 'failed',
    };
  }

  // Routing Logic
  routeAfterKYC(state) {
    if (state.results.kyc && state.results.kyc.success) {
      return 'success';
    }
    return 'failure';
  }

  // Public API
  async processLoanApplication(applicationData) {
    const initialState = {
      ...LOAN_APPLICATION_STATE_SCHEMA,
      applicationId: applicationData.applicationId,
      applicantId: applicationData.applicantId,
      loanType: applicationData.loanType,
      documents: applicationData.documents,
      startTime: Date.now(),
    };

    try {
      console.log(`🚀 Starting ${applicationData.loanType} loan application workflow...`);
      
      const result = await this.app.invoke(initialState);
      
      console.log(`✅ Workflow complete in ${result.processingTime}ms`);
      console.log(`📊 Decision: ${result.finalRecommendation?.decision}`);
      
      return {
        success: result.finalRecommendation?.decision !== 'FAILED',
        applicationId: result.applicationId,
        decision: result.finalRecommendation?.decision,
        recommendation: result.finalRecommendation,
        eligibility: result.loanEligibility,
        risk: result.riskAssessment,
        results: result.results,
        completedSteps: result.completedSteps,
        errors: result.errors,
        metadata: {
          processingTime: result.processingTime,
          timestamp: new Date().toISOString(),
        },
      };

    } catch (error) {
      console.error('❌ Loan application workflow error:', error);
      throw error;
    }
  }
}
