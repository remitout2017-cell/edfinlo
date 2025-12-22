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
    bankBalance: 0, // ✅ ADD: New criterion
  };

  const weights = {
    cibil: 25,
    foir: 20,
    income: 15, // ✅ REDUCED: To make room for bankBalance
    academics: 15,
    university: 10,
    coBorrower: 5,
    tests: 5,
    bankBalance: 5, // ✅ ADD: New weight
  };

  // =====================================================================
  // CIBIL Check
  // =====================================================================
  const avgCibil = studentProfile.financialSummary?.avgCibilScore || 0;

  if (avgCibil >= nbfcCriteria.cibil.minScore) {
    scores.cibil = weights.cibil;
  } else if (avgCibil >= nbfcCriteria.cibil.minScore - 50) {
    scores.cibil = weights.cibil * 0.6; // Borderline
  }

  // ✅ ADD: Bounce/Dishonor instant rejection check
  const totalBounces = studentProfile.financialSummary?.totalBounceCount || 0;
  const totalDishonors =
    studentProfile.financialSummary?.totalDishonorCount || 0;

  if (nbfcCriteria.cibil?.noBounces && totalBounces > 0) {
    scores.cibil = 0; // Instant rejection for bounces
  }

  if (totalDishonors > 0) {
    scores.cibil = Math.max(0, scores.cibil - 10); // Penalty for dishonors
  }

  // =====================================================================
  // FOIR Check
  // =====================================================================
  const avgFoir = studentProfile.financialSummary?.avgFoir || 0;

  if (avgFoir <= nbfcCriteria.foir.maxPercentage) {
    scores.foir = weights.foir;
  } else if (avgFoir <= nbfcCriteria.foir.maxPercentage + 10) {
    scores.foir = weights.foir * 0.6; // Borderline (e.g., 65% FOIR vs 55% max)
  } else if (avgFoir <= nbfcCriteria.foir.maxPercentage + 20) {
    scores.foir = weights.foir * 0.3; // High risk
  }

  // =====================================================================
  // Income Check
  // =====================================================================
  const annualIncome = studentProfile.financialSummary?.avgAnnualIncome || 0;

  if (annualIncome >= nbfcCriteria.incomeItr.minAnnualIncome) {
    scores.income = weights.income;
  } else if (annualIncome >= nbfcCriteria.incomeItr.minAnnualIncome * 0.8) {
    scores.income = weights.income * 0.5; // 80% of requirement
  }

  // =====================================================================
  // ✅ ADD: Bank Balance Check
  // =====================================================================
  const minBalance = studentProfile.financialSummary?.minBankBalance || 0;
  const avgBalance = studentProfile.financialSummary?.avgBankBalance || 0;

  if (nbfcCriteria.bankBalance) {
    // Instant rejection for low average balance (some NBFCs have this)
    if (
      nbfcCriteria.bankBalance.avgMinThreshold &&
      avgBalance < nbfcCriteria.bankBalance.avgMinThreshold
    ) {
      scores.income = 0; // Treat as income insufficiency
    }

    // Bonus for qualifying for partial interest payment schemes
    if (nbfcCriteria.bankBalance.minBalanceRequired) {
      if (minBalance >= nbfcCriteria.bankBalance.minBalanceRequired) {
        scores.bankBalance = weights.bankBalance;
      } else if (
        minBalance >=
        nbfcCriteria.bankBalance.minBalanceRequired * 0.7
      ) {
        scores.bankBalance = weights.bankBalance * 0.5;
      }
    } else {
      // If no specific requirement, give full score if balance exists
      scores.bankBalance = avgBalance > 0 ? weights.bankBalance : 0;
    }
  } else {
    // No bank balance criterion = full score
    scores.bankBalance = weights.bankBalance;
  }

  // =====================================================================
  // Academics Check
  // =====================================================================
  const academics = studentProfile.academics;

  if (academics && academics.status !== "not_provided") {
    let academicPass = true;

    if (
      nbfcCriteria.academics.minPercentage10th &&
      academics.tenthGrade?.percentage <
        nbfcCriteria.academics.minPercentage10th
    ) {
      academicPass = false;
    }

    if (
      nbfcCriteria.academics.minPercentage12th &&
      academics.twelfthGrade?.percentage <
        nbfcCriteria.academics.minPercentage12th
    ) {
      academicPass = false;
    }

    if (
      nbfcCriteria.academics.minPercentageGrad &&
      academics.graduation?.percentage <
        nbfcCriteria.academics.minPercentageGrad
    ) {
      academicPass = false;
    }

    if (
      nbfcCriteria.academics.maxGapYears !== undefined &&
      academics.gapYears > nbfcCriteria.academics.maxGapYears
    ) {
      academicPass = false;
    }

    scores.academics = academicPass
      ? weights.academics
      : weights.academics * 0.4;
  }

  // =====================================================================
  // University Ranking Check
  // =====================================================================
  const admissions = studentProfile.admissionLetters;

  if (
    admissions &&
    admissions.length > 0 &&
    admissions[0].status !== "not_provided"
  ) {
    const topAdmission = admissions[0];

    if (nbfcCriteria.university.rankingRequired) {
      // ✅ FIXED: Handle null worldRank gracefully
      const worldRank = topAdmission.worldRank;

      if (worldRank && worldRank <= nbfcCriteria.university.maxRankThreshold) {
        scores.university = weights.university;
      } else if (
        worldRank &&
        worldRank <= nbfcCriteria.university.maxRankThreshold * 1.5
      ) {
        scores.university = weights.university * 0.6; // Borderline rank
      } else {
        scores.university = weights.university * 0.3; // Unranked or low rank
      }
    } else {
      // No ranking requirement
      scores.university = weights.university;
    }
  }

  // =====================================================================
  // Co-Borrower Check
  // =====================================================================
  if (nbfcCriteria.coBorrower.mandatory) {
    const coBorrowers = studentProfile.coBorrowers;

    if (
      coBorrowers &&
      coBorrowers.length > 0 &&
      coBorrowers[0].kycStatus === "verified"
    ) {
      scores.coBorrower = weights.coBorrower;
    }
  } else {
    // Not mandatory = full score
    scores.coBorrower = weights.coBorrower;
  }

  // =====================================================================
  // Test Scores Check
  // =====================================================================
  const tests = studentProfile.testScores;
  let testPass = false;

  if (tests && tests.status !== "not_provided") {
    if (tests.gre && tests.gre >= (nbfcCriteria.tests?.greMinScore || 0))
      testPass = true;
    if (tests.ielts && tests.ielts >= (nbfcCriteria.tests?.ieltsMinScore || 0))
      testPass = true;
    if (tests.toefl && tests.toefl >= (nbfcCriteria.tests?.toeflMinScore || 0))
      testPass = true;
    if (nbfcCriteria.tests?.othersOptional) testPass = true;
  }

  scores.tests = testPass ? weights.tests : weights.tests * 0.5;

  // =====================================================================
  // Total Score Calculation
  // =====================================================================
  const totalScore = Object.values(scores).reduce(
    (sum, score) => sum + score,
    0
  );

  // ✅ ADD: Enhanced eligibility determination
  let eligibilityStatus;

  if (totalBounces > 0 && nbfcCriteria.cibil?.noBounces) {
    eligibilityStatus = "not_eligible"; // Instant rejection
  } else if (totalScore >= 80) {
    eligibilityStatus = "eligible";
  } else if (totalScore >= 60) {
    eligibilityStatus = "borderline";
  } else {
    eligibilityStatus = "not_eligible";
  }

  return {
    totalScore: Math.round(totalScore),
    breakdown: scores,
    eligibilityStatus,
    // ✅ ADD: Detailed flags for transparency
    flags: {
      hasBounces: totalBounces > 0,
      hasDishonors: totalDishonors > 0,
      lowBankBalance: avgBalance < 10000,
      highFoir: avgFoir > 65,
      lowCibil: avgCibil < 650,
    },
  };
};

module.exports = { calculateMatchScore };
