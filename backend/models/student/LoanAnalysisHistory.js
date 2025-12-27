// models/LoanAnalysisHistory.js
const mongoose = require("mongoose");

const nbfcMatchSchema = new mongoose.Schema(
  {
    nbfcId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NBFC",
      required: true,
    },
    nbfcName: String,
    matchPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    eligibilityStatus: {
      type: String,
      enum: ["eligible", "borderline", "not_eligible"],
    },
    analysis: {
      criteriaAnalysis: mongoose.Schema.Types.Mixed,
      strengths: [String],
      gaps: [String],
      recommendations: [String],
      estimatedROI: {
        min: Number,
        max: Number,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
      },
      error: String,
      fallbackUsed: Boolean,
    },
  },
  { _id: false }
);

const loanAnalysisHistorySchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    // Snapshot of student data at time of analysis
    studentSnapshot: {
      name: String,
      email: String,
      kycStatus: String,
      studyPlan: {
        targetCountry: String,
        targetCourse: String,
        requestedLoanAmount: Number,
        universityName: String,
        intakeMonth: String,
        intakeYear: Number,
      },
      documentHash: String,
      lastDocumentUpdate: Date,
    },

    // NBFC matching results
    nbfcMatches: {
      eligible: [nbfcMatchSchema],
      borderline: [nbfcMatchSchema],
      notEligible: [nbfcMatchSchema],
    },

    // Overall summary
    overallSummary: {
      totalNBFCsAnalyzed: Number,
      eligibleCount: Number,
      borderlineCount: Number,
      notEligibleCount: Number,
      topMatchNBFC: String,
      topMatchPercentage: Number,
    },

    // Analysis metadata
    analysisMetadata: {
      agentVersion: String,
      llmModel: String,
      processingTimeSeconds: Number,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },

    // Status tracking
    status: {
      type: String,
      enum: ["completed", "failed", "partial"],
      default: "completed",
    },

    errors: [String],
  },
  { timestamps: true }
);

// Indexes for efficient queries
loanAnalysisHistorySchema.index({ student: 1, createdAt: -1 });
loanAnalysisHistorySchema.index({ createdAt: -1 });
loanAnalysisHistorySchema.index({ "overallSummary.eligibleCount": -1 });

module.exports = mongoose.model(
  "LoanAnalysisHistory",
  loanAnalysisHistorySchema
);
