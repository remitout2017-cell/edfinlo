// ============================================================================
// 📄 FILE 2: services/NBFCMatcher.js (NEW - Professional NBFC Matching)
// ============================================================================
const NBFC = require("../models/NBFC");

class NBFCMatcher {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Main entry point: Match student profile against all active NBFCs
   */
  async matchStudentWithNBFCs(
    student,
    coBorrowers,
    requestedAmount,
    requestedTenure
  ) {
    console.log("🏦 Starting NBFC matching...");

    // Get all active NBFCs (with caching)
    const nbfcs = await this.getActiveNBFCs();

    if (nbfcs.length === 0) {
      console.warn("⚠️ No active NBFCs found");
      return {
        eligible: [],
        borderline: [],
        notEligible: [],
        summary: {
          eligibleCount: 0,
          borderlineCount: 0,
          notEligibleCount: 0,
          totalAnalyzed: 0,
        },
      };
    }

    console.log(`📋 Evaluating ${nbfcs.length} NBFCs...`);

    const results = {
      eligible: [],
      borderline: [],
      notEligible: [],
    };

    for (const nbfc of nbfcs) {
      const evaluation = this.evaluateNBFCMatch(
        nbfc,
        student,
        coBorrowers,
        requestedAmount,
        requestedTenure
      );

      const nbfcResult = {
        nbfc: nbfc._id,
        nbfcName: nbfc.companyName,
        brandName: nbfc.brandName || nbfc.companyName,
        matchScore: evaluation.matchScore,
        matchPercentage: evaluation.matchPercentage,
        eligibilityStatus: evaluation.status,
        interestRate: (nbfc.loanConfig.roi.minRate + nbfc.loanConfig.roi.maxRate) / 2,
        estimatedROI: {
          min: nbfc.loanConfig.roi.minRate,
          max: nbfc.loanConfig.roi.maxRate,
        },
        recommendation: evaluation.recommendation,
        gaps: evaluation.gaps || [],
        specificRecommendations: evaluation.specificRecommendations || [],
      };

      if (evaluation.status === "eligible") {
        results.eligible.push(nbfcResult);
      } else if (evaluation.status === "borderline") {
        results.borderline.push(nbfcResult);
      } else {
        results.notEligible.push(nbfcResult);
      }
    }

    // Sort by match score
    results.eligible.sort((a, b) => b.matchScore - a.matchScore);
    results.borderline.sort((a, b) => b.matchScore - a.matchScore);

    const summary = {
      eligibleCount: results.eligible.length,
      borderlineCount: results.borderline.length,
      notEligibleCount: results.notEligible.length,
      totalAnalyzed: nbfcs.length,
    };

    console.log(`✅ Match complete: ${summary.eligibleCount} eligible`);

    return { ...results, summary };
  }

  /**
   * Evaluate a single NBFC against student profile
   */
  evaluateNBFCMatch(nbfc, student, coBorrowers, requestedAmount, tenure) {
    const config = nbfc.loanConfig;
    let matchScore = 0;
    const gaps = [];
    const specificRecommendations = [];
    let status = "eligible";

    // ========== 1. LOAN AMOUNT CHECK ==========
    const minAmount = config.loanToIncome.unsecuredMinAmount || 10000;
    const maxAmount = config.loanToIncome.unsecuredMaxAmount || 10000000;

    if (requestedAmount < minAmount || requestedAmount > maxAmount) {
      gaps.push(
        `Loan amount must be between ₹${minAmount.toLocaleString()} and ₹${maxAmount.toLocaleString()}`
      );
      status = "not_eligible";
    } else {
      matchScore += 15;
    }

    // ========== 2. INCOME REQUIREMENTS ==========
    const totalIncome = coBorrowers.reduce(
      (sum, cb) =>
        sum + (cb.financialInfo?.financialSummary?.estimatedAnnualIncome || 0),
      0
    );

    const minRequiredIncome = config.incomeItr.minAnnualIncome || 0;
    if (totalIncome < minRequiredIncome) {
      gaps.push(
        `Minimum annual income: ₹${minRequiredIncome.toLocaleString()}. Current: ₹${totalIncome.toLocaleString()}`
      );
      status = status === "eligible" ? "borderline" : "not_eligible";
      specificRecommendations.push("Increase co-borrower income documentation");
    } else {
      matchScore += 20;
    }

    // ========== 3. FOIR CHECK ==========
    const totalMonthlyIncome = coBorrowers.reduce(
      (sum, cb) =>
        sum + (cb.financialInfo?.financialSummary?.avgMonthlySalary || 0),
      0
    );
    const existingEMI = coBorrowers.reduce(
      (sum, cb) =>
        sum + (cb.financialInfo?.financialSummary?.totalExistingEmi || 0),
      0
    );

    const monthlyRate = 0.1 / 12; // 10% annual
    const estimatedEMI =
      (requestedAmount *
        monthlyRate *
        Math.pow(1 + monthlyRate, tenure)) /
      (Math.pow(1 + monthlyRate, tenure) - 1);

    const totalEMI = existingEMI + estimatedEMI;
    const foir =
      totalMonthlyIncome > 0 ? (totalEMI / totalMonthlyIncome) * 100 : 100;

    const maxFOIR = config.foir.maxPercentage || 75;
    const borderlineFOIR = config.foir.borderlineStart || 60;

    if (foir > maxFOIR) {
      gaps.push(`FOIR too high: ${foir.toFixed(1)}% (max: ${maxFOIR}%)`);
      status = "not_eligible";
      specificRecommendations.push("Reduce existing EMI obligations");
    } else if (foir > borderlineFOIR) {
      gaps.push(`FOIR borderline: ${foir.toFixed(1)}% (ideal: <${borderlineFOIR}%)`);
      status = status === "eligible" ? "borderline" : status;
      matchScore += 10;
    } else {
      matchScore += 25;
    }

    // ========== 4. ACADEMIC REQUIREMENTS ==========
    if (student.academic) {
      const percentage = student.academic.percentage || student.academic.cgpa * 10;
      const minPercentage = config.academics.minPercentageGrad || 55;

      if (percentage < minPercentage) {
        gaps.push(
          `Minimum academic percentage: ${minPercentage}%. Current: ${percentage}%`
        );
        status = status === "eligible" ? "borderline" : "not_eligible";
      } else {
        matchScore += 15;
      }
    } else {
      gaps.push("Academic records missing");
      status = "borderline";
    }

    // ========== 5. ITR REQUIREMENTS ==========
    const itrYearsProvided = coBorrowers.reduce(
      (max, cb) => Math.max(max, cb.financialInfo?.itrData?.length || 0),
      0
    );
    const itrYearsRequired = config.incomeItr.itrYearsRequired || 2;

    if (config.incomeItr.itrRequired && itrYearsProvided < itrYearsRequired) {
      gaps.push(
        `Minimum ${itrYearsRequired} years ITR required. Provided: ${itrYearsProvided}`
      );
      status = status === "eligible" ? "borderline" : "not_eligible";
      specificRecommendations.push(`Upload ${itrYearsRequired - itrYearsProvided} more ITR years`);
    } else {
      matchScore += 10;
    }

    // ========== 6. CO-BORROWER REQUIREMENT ==========
    if (config.coBorrower.mandatory && coBorrowers.length === 0) {
      gaps.push("Co-borrower is mandatory");
      status = "not_eligible";
    } else if (coBorrowers.length > 0) {
      matchScore += 10;

      // Check allowed relations
      const allowedRelations = config.coBorrower.allowedRelations || [];
      const hasValidRelation = coBorrowers.some((cb) =>
        allowedRelations.includes(cb.relationToStudent?.toLowerCase())
      );

      if (allowedRelations.length > 0 && !hasValidRelation) {
        gaps.push(
          `Co-borrower relation must be: ${allowedRelations.join(", ")}`
        );
        status = status === "eligible" ? "borderline" : "not_eligible";
      } else {
        matchScore += 5;
      }
    }

    // ========== 7. ADMISSION LETTER ==========
    if (config.offerLetter.required && !student.admission) {
      if (!config.offerLetter.canSanctionWithout) {
        gaps.push("Admission letter is mandatory");
        status = "not_eligible";
      } else {
        gaps.push("Admission letter preferred");
        status = status === "eligible" ? "borderline" : status;
      }
    } else if (student.admission) {
      matchScore += 10;
    }

    // ========== 8. CALCULATE MATCH PERCENTAGE ==========
    const matchPercentage = Math.min(100, Math.round(matchScore));

    // ========== 9. GENERATE RECOMMENDATION ==========
    let recommendation;
    if (status === "eligible") {
      if (matchPercentage >= 80) {
        recommendation = "Highly recommended - Excellent match";
      } else if (matchPercentage >= 60) {
        recommendation = "Good match - Application likely to be approved";
      } else {
        recommendation = "Acceptable match - Consider applying";
      }
    } else if (status === "borderline") {
      recommendation = `Borderline case - ${gaps.length} requirement(s) need attention`;
    } else {
      recommendation = `Not eligible - ${gaps.length} critical requirement(s) not met`;
    }

    return {
      matchScore,
      matchPercentage,
      status,
      gaps,
      specificRecommendations,
      recommendation,
    };
  }

  /**
   * Get active NBFCs with caching
   */
  async getActiveNBFCs() {
    const cacheKey = "active_nbfcs";
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log("📦 Using cached NBFC list");
      return cached.data;
    }

    const nbfcs = await NBFC.find({
      isActive: true,
      isApprovedByAdmin: true,
      "loanConfig.enabled": true,
    })
      .select(
        "companyName brandName loanConfig.roi loanConfig.foir loanConfig.incomeItr loanConfig.loanToIncome loanConfig.academics loanConfig.coBorrower loanConfig.offerLetter"
      )
      .lean();

    this.cache.set(cacheKey, {
      data: nbfcs,
      timestamp: Date.now(),
    });

    return nbfcs;
  }

  /**
   * Clear cache (call when NBFC config changes)
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new NBFCMatcher();
