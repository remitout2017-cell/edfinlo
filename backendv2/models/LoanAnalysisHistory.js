// ============================================================================
// 📄 FILE 1: models/LoanAnalysisHistory.js (REWRITTEN - Option B)
// ============================================================================
const mongoose = require("mongoose");

const loanAnalysisHistorySchema = new mongoose.Schema(
  {
    // Student reference
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    // Loan request details
    requestedAmount: {
      type: Number,
      required: true,
      min: 10000,
    },
    requestedTenure: {
      type: Number,
      required: true,
      min: 6,
      max: 180, // Up to 15 years
    },
    purpose: {
      type: String,
      default: "Education",
    },
    urgency: {
      type: String,
      enum: ["normal", "urgent"],
      default: "normal",
    },

    // ========== ELIGIBILITY ASSESSMENT ==========
    eligibility: {
      eligible: { type: Boolean, required: true },
      maxEligibleAmount: { type: Number, default: 0 },
      recommendedAmount: { type: Number, default: 0 },
      recommendedTenure: { type: Number, default: 60 },
      approvalProbability: { type: Number, min: 0, max: 100 },
      reasoning: { type: String },
      factors: {
        academic: {
          type: String,
          enum: ["excellent", "good", "average", "poor", "missing"],
        },
        financial: {
          type: String,
          enum: ["strong", "moderate", "weak", "missing"],
        },
        documentation: {
          type: String,
          enum: ["complete", "partial", "incomplete"],
        },
      },
    },

    // ========== RISK ASSESSMENT ==========
    riskAssessment: {
      overallRisk: {
        type: String,
        enum: ["low", "medium", "high"],
        required: true,
      },
      riskScore: { type: Number, min: 0, max: 100 },
      riskLevel: {
        type: String,
        enum: ["very_low", "low", "moderate", "high", "very_high"],
      },
      riskFactors: [String],
      strengths: [String],
      mitigationSuggestions: [String],
    },

    // ========== FINANCIAL SUMMARY ==========
    financialSummary: {
      totalMonthlyIncome: { type: Number, default: 0 },
      existingObligations: { type: Number, default: 0 },
      estimatedEmi: { type: Number, default: 0 },
      totalEmi: { type: Number, default: 0 },
      foir: { type: Number, default: 0 },
      availableIncome: { type: Number, default: 0 },
      debtToIncomeRatio: { type: Number, default: 0 },
      affordability: {
        type: String,
        enum: ["excellent", "good", "moderate", "poor"],
      },
    },

    // ========== MATCHED NBFCs ==========
    matchedNBFCs: [
      {
        nbfc: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "NBFC",
        },
        nbfcName: String,
        brandName: String,
        matchScore: { type: Number, min: 0, max: 100 },
        matchPercentage: { type: Number, min: 0, max: 100 },
        eligibilityStatus: {
          type: String,
          enum: ["eligible", "borderline", "not_eligible"],
        },
        interestRate: Number,
        processingFee: Number,
        estimatedROI: {
          min: Number,
          max: Number,
        },
        recommendation: String,
        gaps: [String], // For borderline cases
        specificRecommendations: [String],
      },
    ],

    // NBFC Summary counts
    nbfcSummary: {
      eligibleCount: { type: Number, default: 0 },
      borderlineCount: { type: Number, default: 0 },
      notEligibleCount: { type: Number, default: 0 },
      totalAnalyzed: { type: Number, default: 0 },
    },

    // ========== RECOMMENDATIONS ==========
    recommendations: {
      alternatives: [
        {
          option: String,
          description: String,
          pros: [String],
          cons: [String],
        },
      ],
      improvements: [String],
      timeline: {
        immediate: [String],
        shortTerm: [String],
        longTerm: [String],
      },
      nextSteps: [
        {
          step: Number,
          action: String,
          description: String,
          priority: {
            type: String,
            enum: ["high", "medium", "low"],
          },
        },
      ],
    },

    // ========== METADATA ==========
    analysisMetadata: {
      analysisDate: { type: Date, default: Date.now },
      processingTimeMs: Number,
      aiModel: { type: String, default: "gemini-2.0-flash" },
      workflowVersion: { type: String, default: "2.0" },
      cached: { type: Boolean, default: false },
    },

    // Status
    status: {
      type: String,
      enum: ["completed", "eligible", "not_eligible", "failed", "in_progress"],
      default: "completed",
      required: true,
    },

    // Error tracking
    error: {
      message: String,
      stack: String,
      code: String,
    },

    // Student snapshot at analysis time
    studentSnapshot: {
      hasKYC: Boolean,
      hasAcademicRecords: Boolean,
      hasAdmissionLetter: Boolean,
      hasWorkExperience: Boolean,
      coBorrowerCount: Number,
      kycStatus: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ========== INDEXES ==========
loanAnalysisHistorySchema.index({ student: 1, createdAt: -1 });
loanAnalysisHistorySchema.index({ status: 1, createdAt: -1 });
loanAnalysisHistorySchema.index({
  student: 1,
  "eligibility.eligible": 1,
  createdAt: -1,
});
loanAnalysisHistorySchema.index({ "matchedNBFCs.nbfc": 1 });

// ========== VIRTUALS ==========
loanAnalysisHistorySchema.virtual("processingTimeSeconds").get(function () {
  return this.analysisMetadata.processingTimeMs
    ? (this.analysisMetadata.processingTimeMs / 1000).toFixed(2)
    : 0;
});

// ========== INSTANCE METHODS ==========
loanAnalysisHistorySchema.methods.compareWithPrevious = async function () {
  const previousAnalysis = await this.constructor
    .findOne({
      student: this.student,
      _id: { $lt: this._id },
      status: { $in: ["completed", "eligible", "not_eligible"] },
    })
    .sort({ createdAt: -1 });

  if (!previousAnalysis) {
    return {
      hasPrevious: false,
      improvements: [],
      declines: [],
    };
  }

  const improvements = [];
  const declines = [];

  // Compare eligibility
  if (this.eligibility.eligible && !previousAnalysis.eligibility.eligible) {
    improvements.push("Became eligible for loan");
  } else if (
    !this.eligibility.eligible &&
    previousAnalysis.eligibility.eligible
  ) {
    declines.push("Lost loan eligibility");
  }

  // Compare max eligible amount
  const amountChange =
    this.eligibility.maxEligibleAmount -
    previousAnalysis.eligibility.maxEligibleAmount;
  if (amountChange > 0) {
    improvements.push(`Max eligible amount increased by ₹${amountChange}`);
  } else if (amountChange < 0) {
    declines.push(
      `Max eligible amount decreased by ₹${Math.abs(amountChange)}`
    );
  }

  // Compare NBFC matches
  const nbfcChange =
    this.nbfcSummary.eligibleCount - previousAnalysis.nbfcSummary.eligibleCount;
  if (nbfcChange > 0) {
    improvements.push(`${nbfcChange} more NBFCs now eligible`);
  } else if (nbfcChange < 0) {
    declines.push(`${Math.abs(nbfcChange)} fewer NBFCs now eligible`);
  }

  return {
    hasPrevious: true,
    previousDate: previousAnalysis.createdAt,
    improvements,
    declines,
    daysSincePrevious: Math.floor(
      (this.createdAt - previousAnalysis.createdAt) / (1000 * 60 * 60 * 24)
    ),
  };
};

// ========== STATIC METHODS ==========
loanAnalysisHistorySchema.statics.getStudentHistory = async function (
  studentId,
  options = {}
) {
  const { limit = 10, page = 1 } = options;
  const skip = (page - 1) * limit;

  const query = {
    student: studentId,
    status: { $in: ["completed", "eligible", "not_eligible"] },
  };

  const [analyses, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate("matchedNBFCs.nbfc", "companyName brandName")
      .lean(),
    this.countDocuments(query),
  ]);

  const stats = {
    totalAnalyses: total,
    eligibleCount: analyses.filter((a) => a.eligibility.eligible).length,
    averageMatchedNBFCs:
      analyses.length > 0
        ? Math.round(
            analyses.reduce((sum, a) => sum + a.nbfcSummary.eligibleCount, 0) /
              analyses.length
          )
        : 0,
    mostRecentDate: analyses[0]?.createdAt || null,
  };

  return {
    analyses,
    stats,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      hasMore: skip + analyses.length < total,
    },
  };
};

module.exports = mongoose.model(
  "LoanAnalysisHistory",
  loanAnalysisHistorySchema
);
