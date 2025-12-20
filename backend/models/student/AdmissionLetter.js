// models/AdmissionLetter.js
const mongoose = require("mongoose");

const AdmissionLetterSchema = new mongoose.Schema(
  {
    // User reference
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    // Document storage
    admissionLetterUrl: {
      type: String,
      required: function () {
        return this.status === "verified";
      },
    },

    // Processing status
    status: {
      type: String,
      enum: ["verified", "failed", "pending"],
      default: "pending",
      index: true,
    },

    failureReason: String,
    validationIssues: [String],
    riskIssues: [String],

    // ========== CORE ADMISSION DATA ==========
    universityName: String,
    programName: String,
    degreeLevel: String,

    intakeTerm: String,
    intakeYear: Number,

    country: String,
    city: String,
    duration: String,

    // Financial information
    tuitionFee: Number,
    tuitionCurrency: {
      type: String,
      default: "USD",
    },
    scholarshipAmount: Number,
    scholarshipMentioned: Boolean,

    // Deadlines
    acceptanceDeadline: String,
    enrollmentDeadline: String,
    feePaymentDeadline: String,

    // Student information
    studentId: String,
    applicationId: String,

    // Conditional admission
    conditionalAdmission: Boolean,
    conditions: [String],
    documentsRequired: [String],

    // ========== UNIVERSITY SCORING SECTION ==========
    universityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    riskLevel: {
      type: String,
      enum: ["low", "medium_low", "medium", "medium_high", "high"],
      default: "medium",
    },

    issuesFound: [String],
    strengths: [String],

    scoreBreakdown: {
      ranking: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      reputation: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      admissionQuality: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      countryFactor: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    },

    verificationLevel: {
      type: String,
      enum: ["high", "medium", "low", "pending"],
      default: "pending",
    },

    // University ranking data
    universityRanking: {
      qsWorldRanking: Number,
      timesWorldRanking: Number,
      usNewsRanking: Number,
      rankingYear: Number,
      rankingNotes: String,
    },

    // Document authenticity
    documentAuthenticity: {
      score: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 0,
      },
      factors: [String],
    },

    // ========== EXTRACTION METADATA ==========
    extractionConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    documentQuality: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    notes: String,

    // AI evaluation source
    evaluationSource: {
      type: String,
      default: "admission-agent-v2-scoring",
    },

    geminiSummary: String,
    groqSummary: String,

    // Raw structured extraction
    extractedFields: {
      type: mongoose.Schema.Types.Mixed,
    },

    evaluatedAt: {
      type: Date,
      default: Date.now,
    },

    processingTimeSeconds: Number,

    // Loan approval factors
    loanApprovalFactors: {
      eligibilityScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      riskFactors: [String],
      recommendations: [String],
      decision: {
        type: String,
        enum: ["approve", "review", "reject", "pending"],
        default: "pending",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ========== VIRTUAL FIELDS ==========

// Score category
AdmissionLetterSchema.virtual("scoreCategory").get(function () {
  const score = this.universityScore || 0;
  if (score >= 80) return "excellent";
  if (score >= 70) return "good";
  if (score >= 60) return "average";
  if (score >= 50) return "below_average";
  return "poor";
});

// Risk color for UI
AdmissionLetterSchema.virtual("riskColor").get(function () {
  const risk = this.riskLevel || "medium";
  switch (risk) {
    case "low":
      return "#10b981"; // green
    case "medium_low":
      return "#84cc16"; // lime
    case "medium":
      return "#f59e0b"; // amber
    case "medium_high":
      return "#f97316"; // orange
    case "high":
      return "#ef4444"; // red
    default:
      return "#6b7280"; // gray
  }
});

// Status color
AdmissionLetterSchema.virtual("statusColor").get(function () {
  switch (this.status) {
    case "verified":
      return "#10b981";
    case "pending":
      return "#f59e0b";
    case "failed":
      return "#ef4444";
    default:
      return "#6b7280";
  }
});

// Check if has upcoming deadlines
AdmissionLetterSchema.virtual("hasUpcomingDeadlines").get(function () {
  const today = new Date();
  const deadlines = [
    this.acceptanceDeadline,
    this.enrollmentDeadline,
    this.feePaymentDeadline,
  ].filter(Boolean);

  return deadlines.length > 0;
});

// Calculate days until next deadline
AdmissionLetterSchema.virtual("nextDeadline").get(function () {
  const deadlines = [];

  if (this.acceptanceDeadline) {
    deadlines.push({
      type: "Acceptance",
      date: this.acceptanceDeadline,
    });
  }

  if (this.enrollmentDeadline) {
    deadlines.push({
      type: "Enrollment",
      date: this.enrollmentDeadline,
    });
  }

  if (this.feePaymentDeadline) {
    deadlines.push({
      type: "Fee Payment",
      date: this.feePaymentDeadline,
    });
  }

  if (deadlines.length === 0) return null;

  // Sort by date
  deadlines.sort((a, b) => {
    const dateA = this._parseDate(a.date);
    const dateB = this._parseDate(b.date);
    return dateA - dateB;
  });

  return deadlines[0];
});

// Helper method to parse date
AdmissionLetterSchema.methods._parseDate = function (dateStr) {
  if (!dateStr) return new Date(8640000000000000); // Far future

  try {
    // Try DD/MM/YYYY format
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }

    // Try other formats
    return new Date(dateStr);
  } catch (error) {
    return new Date(8640000000000000);
  }
};

// ========== STATIC METHODS ==========

// Get average score for a country
AdmissionLetterSchema.statics.getCountryAverageScore = async function (
  country
) {
  const result = await this.aggregate([
    {
      $match: {
        country: new RegExp(`^${country}$`, "i"),
        universityScore: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: null,
        avgScore: { $avg: "$universityScore" },
        count: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { avgScore: 0, count: 0 };
};

// Get score distribution
AdmissionLetterSchema.statics.getScoreDistribution = async function () {
  const distribution = await this.aggregate([
    {
      $match: {
        universityScore: { $exists: true, $ne: null },
      },
    },
    {
      $bucket: {
        groupBy: "$universityScore",
        boundaries: [0, 50, 60, 70, 80, 90, 101],
        default: "other",
        output: {
          count: { $sum: 1 },
          universities: { $push: "$universityName" },
        },
      },
    },
    {
      $project: {
        range: {
          $switch: {
            branches: [
              { case: { $lt: ["$_id", 50] }, then: "Below 50" },
              { case: { $lt: ["$_id", 60] }, then: "50-59" },
              { case: { $lt: ["$_id", 70] }, then: "60-69" },
              { case: { $lt: ["$_id", 80] }, then: "70-79" },
              { case: { $lt: ["$_id", 90] }, then: "80-89" },
              { case: { $lt: ["$_id", 101] }, then: "90-100" },
            ],
            default: "Unknown",
          },
        },
        count: 1,
        sampleUniversities: { $slice: ["$universities", 5] },
      },
    },
  ]);

  return distribution;
};

// ========== INDEXES ==========

AdmissionLetterSchema.index({ universityScore: -1 });
AdmissionLetterSchema.index({ riskLevel: 1 });
AdmissionLetterSchema.index({ country: 1 });
AdmissionLetterSchema.index({ status: 1 });
AdmissionLetterSchema.index({ user: 1 }, { unique: true });
AdmissionLetterSchema.index({ createdAt: -1 });
AdmissionLetterSchema.index({ universityName: "text", programName: "text" });

// ========== MIDDLEWARE ==========

// Auto-calculate loan approval factors before save
AdmissionLetterSchema.pre("save", function (next) {
  // Calculate eligibility score based on university score
  if (this.universityScore !== null && this.universityScore !== undefined) {
    this.loanApprovalFactors.eligibilityScore = this.universityScore;

    // Auto decision based on score
    if (this.universityScore >= 75) {
      this.loanApprovalFactors.decision = "approve";
    } else if (this.universityScore >= 60) {
      this.loanApprovalFactors.decision = "review";
    } else if (this.universityScore < 50) {
      this.loanApprovalFactors.decision = "reject";
    }

    // Add recommendations
    this.loanApprovalFactors.recommendations = [];
    if (this.universityScore >= 80) {
      this.loanApprovalFactors.recommendations.push(
        "High priority - excellent university"
      );
      this.loanApprovalFactors.recommendations.push(
        "Consider maximum loan amount"
      );
    } else if (this.universityScore >= 70) {
      this.loanApprovalFactors.recommendations.push(
        "Good candidate for approval"
      );
      this.loanApprovalFactors.recommendations.push(
        "Standard verification required"
      );
    } else if (this.universityScore >= 60) {
      this.loanApprovalFactors.recommendations.push(
        "Additional verification recommended"
      );
      this.loanApprovalFactors.recommendations.push("Consider partial funding");
    }
  }

  next();
});

module.exports = mongoose.model("AdmissionLetter", AdmissionLetterSchema);
