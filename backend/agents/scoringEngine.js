// agents/scoringEngine.js

/**
 * Rule-based scoring engine (fallback if AI fails)
 */
const calculateMatchScore = (studentProfile, nbfcCriteria) => {
  const scores = {
    cibil: 0,
    foir: 0,
    income: 0,
    academics: 0,
    university: 0,
    coBorrower: 0,
    tests: 0,
  };

  const weights = {
    cibil: 25,
    foir: 20,
    income: 20,
    academics: 15,
    university: 10,
    coBorrower: 5,
    tests: 5,
  };

  // CIBIL Check
  const avgCibil = studentProfile.financialSummary?.avgCibilScore || 0;
  if (avgCibil >= nbfcCriteria.cibil.minScore) {
    scores.cibil = weights.cibil;
  } else if (avgCibil >= nbfcCriteria.cibil.minScore - 50) {
    scores.cibil = weights.cibil * 0.6; // Borderline
  }

  // FOIR Check
  const avgFoir = studentProfile.financialSummary?.avgFoir || 0;
  if (avgFoir <= nbfcCriteria.foir.maxPercentage) {
    scores.foir = weights.foir;
  } else if (avgFoir <= nbfcCriteria.foir.maxPercentage + 10) {
    scores.foir = weights.foir * 0.6;
  }

  // Income Check
  const annualIncome = studentProfile.financialSummary?.avgAnnualIncome || 0;
  if (annualIncome >= nbfcCriteria.incomeItr.minAnnualIncome) {
    scores.income = weights.income;
  } else if (annualIncome >= nbfcCriteria.incomeItr.minAnnualIncome * 0.8) {
    scores.income = weights.income * 0.5;
  }

  // Academics Check
  const academics = studentProfile.academics;
  if (academics && academics.status !== "not_provided") {
    let academicPass = true;
    
    if (academics.tenthGrade?.percentage < nbfcCriteria.academics.minPercentage10th) {
      academicPass = false;
    }
    if (academics.twelfthGrade?.percentage < nbfcCriteria.academics.minPercentage12th) {
      academicPass = false;
    }
    if (academics.graduation?.percentage < nbfcCriteria.academics.minPercentageGrad) {
      academicPass = false;
    }
    if (academics.gapYears > nbfcCriteria.academics.maxGapYears) {
      academicPass = false;
    }
    
    scores.academics = academicPass ? weights.academics : weights.academics * 0.4;
  }

  // University Check
  const admissions = studentProfile.admissionLetters;
  if (admissions && admissions.length > 0 && admissions[0].status !== "not_provided") {
    const topAdmission = admissions[0];
    if (nbfcCriteria.university.rankingRequired) {
      if (topAdmission.worldRank && topAdmission.worldRank <= nbfcCriteria.university.maxRankThreshold) {
        scores.university = weights.university;
      } else {
        scores.university = weights.university * 0.3;
      }
    } else {
      scores.university = weights.university;
    }
  }

  // Co-Borrower Check
  if (nbfcCriteria.coBorrower.mandatory) {
    if (studentProfile.coBorrowers?.length > 0 && studentProfile.coBorrowers[0].kycStatus === "verified") {
      scores.coBorrower = weights.coBorrower;
    }
  } else {
    scores.coBorrower = weights.coBorrower;
  }

  // Test Scores Check
  const tests = studentProfile.testScores;
  let testPass = false;
  if (tests && tests.status !== "not_provided") {
    if (tests.gre && tests.gre >= (nbfcCriteria.tests.greMinScore || 0)) testPass = true;
    if (tests.ielts && tests.ielts >= (nbfcCriteria.tests.ieltsMinScore || 0)) testPass = true;
    if (tests.toefl && tests.toefl >= (nbfcCriteria.tests.toeflMinScore || 0)) testPass = true;
    if (nbfcCriteria.tests.othersOptional) testPass = true;
  }
  scores.tests = testPass ? weights.tests : weights.tests * 0.5;

  // Total score
  const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);

  return {
    totalScore: Math.round(totalScore),
    breakdown: scores,
    eligibilityStatus: 
      totalScore >= 80 ? "eligible" : 
      totalScore >= 60 ? "borderline" : 
      "not_eligible",
  };
};

module.exports = { calculateMatchScore };
