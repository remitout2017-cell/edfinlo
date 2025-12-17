// ai/workflows/index.js
export { LoanApplicationWorkflow } from './LoanApplicationWorkflow.js';
export { KYCWorkflow } from './KYCWorkflow.js';
export { FinancialWorkflow } from './FinancialWorkflow.js';
export { AcademicWorkflow } from './AcademicWorkflow.js';
export { LoanAnalysisWorkflow } from './LoanAnalysisWorkflow.js';

// Convenience functions
export function createLoanWorkflow() {
  return new LoanApplicationWorkflow();
}

export function createKYCWorkflow() {
  return new KYCWorkflow();
}

export function createFinancialWorkflow() {
  return new FinancialWorkflow();
}

export function createAcademicWorkflow() {
  return new AcademicWorkflow();
}

export function createLoanAnalysisWorkflow() {
  return new LoanAnalysisWorkflow();
}
