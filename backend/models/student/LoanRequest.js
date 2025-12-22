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

    // Request status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },

    // Student's message to NBFC
    studentMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // NBFC decision details
    nbfcDecision: {
      decidedAt: Date,
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "NBFC",
      },
      reason: {
        type: String,
        trim: true,
      },
      offeredAmount: {
        type: Number,
        min: 0,
      },
      offeredRoi: {
        type: Number,
        min: 0,
        max: 30,
      },
      processingFee: Number,
      tenureMonths: Number,
      additionalTerms: String,
    },

    // Student acceptance of NBFC offer
    studentAcceptance: {
      accepted: {
        type: Boolean,
        default: false,
      },
      acceptedAt: Date,
      rejectionReason: String,
    },

    // Snapshot of key data at time of request (for NBFC quick view)
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
        matchPercentage: Number,
        eligibilityStatus: String,
      },
      studyPlan: {
        targetCountry: String,
        targetCourse: String,
        universityName: String,
        requestedLoanAmount: Number,
      },
    },

    // Communication history (optional for future chat feature)
    communications: [
      {
        from: {
          type: String,
          enum: ["student", "nbfc"],
        },
        message: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        attachments: [String],
      },
    ],

    // Tracking
    viewedByNBFC: {
      type: Boolean,
      default: false,
    },
    viewedAt: Date,

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
loanRequestSchema.index({ student: 1, nbfc: 1, status: 1 });
loanRequestSchema.index({ student: 1, createdAt: -1 });
loanRequestSchema.index({ nbfc: 1, status: 1, createdAt: -1 });
loanRequestSchema.index({ createdAt: -1 });
loanRequestSchema.index({ status: 1, createdAt: -1 });

// Prevent duplicate active requests
loanRequestSchema.index(
  { student: 1, nbfc: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "approved"] },
      isDeleted: false,
    },
  }
);

// Methods
loanRequestSchema.methods.markAsViewed = function () {
  this.viewedByNBFC = true;
  this.viewedAt = new Date();
  return this.save();
};

loanRequestSchema.methods.cancel = function () {
  if (this.status !== "pending") {
    throw new Error("Only pending requests can be cancelled");
  }
  this.status = "cancelled";
  return this.save();
};

// Statics
loanRequestSchema.statics.getStudentStats = async function (studentId) {
  return await this.aggregate([
    {
      $match: { student: mongoose.Types.ObjectId(studentId), isDeleted: false },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
};

loanRequestSchema.statics.getNBFCStats = async function (nbfcId) {
  return await this.aggregate([
    { $match: { nbfc: mongoose.Types.ObjectId(nbfcId), isDeleted: false } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
};

module.exports = mongoose.model("LoanRequest", loanRequestSchema);
