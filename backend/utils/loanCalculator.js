// utils/loanCalculator.js

/**
 * Calculate EMI (Equated Monthly Installment)
 * @param {number} principal - Loan amount
 * @param {number} annualRate - Annual interest rate (%)
 * @param {number} tenureMonths - Loan tenure in months
 */
const calculateEMI = (principal, annualRate, tenureMonths) => {
  const monthlyRate = annualRate / 12 / 100;
  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  return Math.round(emi);
};

/**
 * Calculate total interest payable
 */
const calculateTotalInterest = (principal, annualRate, tenureMonths) => {
  const emi = calculateEMI(principal, annualRate, tenureMonths);
  const totalPayment = emi * tenureMonths;
  return Math.round(totalPayment - principal);
};

/**
 * Calculate eligible loan amount based on income
 * @param {number} monthlyIncome - Combined monthly income
 * @param {number} existingEMI - Existing monthly EMI obligations
 * @param {number} maxFOIR - Maximum FOIR allowed (%)
 * @param {number} roi - Rate of interest
 * @param {number} tenureMonths - Loan tenure
 */
const calculateEligibleLoanAmount = (
  monthlyIncome,
  existingEMI,
  maxFOIR,
  roi,
  tenureMonths
) => {
  const maxEMI = (monthlyIncome * maxFOIR) / 100 - existingEMI;
  
  if (maxEMI <= 0) return 0;

  const monthlyRate = roi / 12 / 100;
  const principal =
    (maxEMI * (Math.pow(1 + monthlyRate, tenureMonths) - 1)) /
    (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths));

  return Math.round(principal);
};

module.exports = {
  calculateEMI,
  calculateTotalInterest,
  calculateEligibleLoanAmount,
};
