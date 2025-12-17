// models/LoanRequest.js
const mongoose = require("mongoose");

const loanRequestSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    nbfc: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NBFC",
      required: true,
      index: true,
    },

    // Link to the analysis snapshot used when sending this request
    analysisHistory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LoanAnalysisHistory",
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },

    // Optional: NBFC decision details
    nbfcDecision: {
      decidedAt: Date,
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "NBFC", // later if you model NBFC users separately, change this
      },
      reason: String,
      offeredAmount: Number,
      offeredRoi: Number,
    },

    // When student explicitly accepts NBFC offer
    studentAcceptance: {
      accepted: { type: Boolean, default: false },
      acceptedAt: Date,
    },

    // Snapshot of key data so NBFC can see without re-running full analysis
    snapshot: {
      student: {
        name: String,
        email: String,
        phoneNumber: String,
      },
      eligibility: {
        overallScore: Number,
        statusLabel: String,
        eligibleLoanAmountMin: Number,
        eligibleLoanAmountMax: Number,
      },
      nbfcMatch: {
        nbfcId: mongoose.Schema.Types.ObjectId,
        nbfcName: String,
        brandName: String,
        matchPercentage: Number,
        eligibilityStatus: String,
      },
    },
  },
  { timestamps: true }
);

loanRequestSchema.index({ student: 1, nbfc: 1, status: 1 });
// Add to LoanRequest.js:
loanRequestSchema.index({ createdAt: -1 });
loanRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("LoanRequest", loanRequestSchema);
