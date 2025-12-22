// models/student/CoBorrower.js
const mongoose = require("mongoose");

// ============================================================================
// KYC Data Schema
// ============================================================================
const kycDataSchema = new mongoose.Schema(
  {
    aadhaarFrontUrl: String,
    aadhaarBackUrl: String,
    panFrontUrl: String,
    passportUrl: String,

    aadhaarFrontPublicId: { type: String, select: false },
    aadhaarBackPublicId: { type: String, select: false },
    panFrontPublicId: { type: String, select: false },
    passportPublicId: { type: String, select: false },

    aadhaarFrontResourceType: { type: String, select: false },
    aadhaarBackResourceType: { type: String, select: false },
    panFrontResourceType: { type: String, select: false },
    passportResourceType: { type: String, select: false },

    aadhaarFrontType: { type: String, select: false },
    aadhaarBackType: { type: String, select: false },
    panFrontType: { type: String, select: false },
    passportType: { type: String, select: false },

    aadhaarNumber: { type: String, select: false },
    panNumber: { type: String, select: false },
    passportNumber: { type: String, select: false },

    aadhaarName: String,
    aadhaarDOB: String,
    aadhaarGender: String,
    aadhaarAddress: String,
    panName: String,
    panFatherName: String,
    panDOB: String,
    passportName: String,

    verificationScore: Number,
    verificationMethod: String,
    verificationReason: String,
    lastVerifiedAt: Date,
  },
  { _id: false }
);

// ============================================================================
// Financial Documents Schema
// ============================================================================
const financialDocumentsSchema = new mongoose.Schema(
  {
    salarySlips: {
      documentUrls: [String],
      cloudinaryPublicIds: { type: [String], select: false },
      uploadedAt: Date,
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
      },
    },
    bankStatement: {
      documentUrls: [String],
      cloudinaryPublicIds: { type: [String], select: false },
      uploadedAt: Date,
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
      },
    },
    itr1: {
      documentUrls: [String],
      cloudinaryPublicIds: { type: [String], select: false },
      uploadedAt: Date,
      year: String,
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
      },
    },
    itr2: {
      documentUrls: [String],
      cloudinaryPublicIds: { type: [String], select: false },
      uploadedAt: Date,
      year: String,
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
      },
    },
    form16: {
      documentUrls: [String],
      cloudinaryPublicIds: { type: [String], select: false },
      uploadedAt: Date,
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
      },
    },
  },
  { _id: false }
);

// ============================================================================
// Financial Analysis Schema
// ============================================================================
const financialAnalysisSchema = new mongoose.Schema(
  {
    sessionId: String,
    processingTimeSeconds: Number,
    timestamp: Date,
    extractedData: {
      itr: mongoose.Schema.Types.Mixed,
      bankStatement: mongoose.Schema.Types.Mixed,
      salarySlips: mongoose.Schema.Types.Mixed,
    },
    foir: {
      foirPercentage: Number,
      foirStatus: String,
      monthlyNetIncome: Number,
      totalMonthlyEmi: Number,
      availableMonthlyIncome: Number,
    },
    cibil: {
      estimatedScore: Number,
      riskLevel: String,
      confidence: Number,
      positiveFactors: [String],
      negativeFactors: [String],
    },
    quality: {
      overallConfidence: Number,
      dataSourcesUsed: [String],
      missingData: [String],
    },
    documentsProcessed: {
      salarySlips: Boolean,
      bankStatement: Boolean,
      itr1: Boolean,
      itr2: Boolean,
      form16: Boolean,
    },
    errors: [String],
    rawResponse: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

// ============================================================================
// Main CoBorrower Schema
// ============================================================================
const CoBorrowerSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    relationToStudent: {
      type: String,
      required: true,
      enum: ["Father", "Mother", "Guardian", "Spouse", "Sibling", "Other"],
    },
    email: { type: String, trim: true, lowercase: true, sparse: true },
    phoneNumber: { type: String, trim: true, sparse: true },
    dateOfBirth: Date,

    kycStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    kycVerifiedAt: Date,
    kycRejectedAt: Date,
    kycData: kycDataSchema,

    financialDocuments: financialDocumentsSchema,
    financialVerificationStatus: {
      type: String,
      enum: ["pending", "processing", "verified", "failed", "partial"],
      default: "pending",
      index: true,
    },

    financialVerifiedAt: Date,
    financialVerificationConfidence: { type: Number, min: 0, max: 1 },
    financialVerificationErrors: [String],
    financialAnalysis: financialAnalysisSchema,

    financialSummary: {
      avgMonthlySalary: Number,
      avgMonthlyIncome: Number,
      estimatedAnnualIncome: Number,
      totalExistingEmi: Number,
      foir: Number,
      // ✅ ADD THESE 5 FIELDS:
      avgBankBalance: Number,
      minBankBalance: Number,
      bounceCount: Number,
      dishonorCount: Number,
      insufficientFundIncidents: Number,
      foirStatus: String,
      cibilEstimate: Number,
      cibilRiskLevel: String,
      incomeStability: String,
      overallScore: Number,
      documentCompleteness: {
        hasKYC: Boolean,
        hasSalarySlips: Boolean,
        hasBankStatement: Boolean,
        hasITR: Boolean,
        hasForm16: Boolean,
        completenessScore: Number,
      },
      verificationStatus: String,
      lastUpdated: Date,
      nextAction: String,
    },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================================================
// Indexes
// ============================================================================
CoBorrowerSchema.index({ student: 1, createdAt: -1 });
CoBorrowerSchema.index({ student: 1, kycStatus: 1 });
CoBorrowerSchema.index({ student: 1, financialVerificationStatus: 1 });

CoBorrowerSchema.index(
  { student: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $exists: true, $ne: null, $ne: "" },
      isDeleted: false,
      kycStatus: "verified",
    },
  }
);

CoBorrowerSchema.index(
  { student: 1, phoneNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phoneNumber: { $exists: true, $ne: null, $ne: "" },
      isDeleted: false,
      kycStatus: "verified",
    },
  }
);

// ============================================================================
// Virtuals
// ============================================================================
CoBorrowerSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim() || "Unknown";
});

CoBorrowerSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - this.dateOfBirth.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

// ============================================================================
// Pre-save Middleware
// ============================================================================
CoBorrowerSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  if (
    this.financialAnalysis &&
    (this.isNew || this.isModified("financialAnalysis"))
  ) {
    try {
      this.updateFinancialSummary();
    } catch (error) {
      console.error("Error updating financial summary:", error);
    }
  }

  next();
});

// ============================================================================
// Static Methods
// ============================================================================
CoBorrowerSchema.statics.checkDuplicateEmail = async function (
  studentId,
  email,
  excludeId = null
) {
  if (!email || email.trim() === "") return null;

  const query = {
    student: studentId,
    email: email.toLowerCase().trim(),
    isDeleted: false,
    kycStatus: "verified",
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return await this.findOne(query).select("firstName lastName email kycStatus");
};

CoBorrowerSchema.statics.checkDuplicatePhone = async function (
  studentId,
  phoneNumber,
  excludeId = null
) {
  if (!phoneNumber || phoneNumber.trim() === "") return null;

  const query = {
    student: studentId,
    phoneNumber: phoneNumber.trim(),
    isDeleted: false,
    kycStatus: "verified",
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return await this.findOne(query).select(
    "firstName lastName phoneNumber kycStatus"
  );
};

CoBorrowerSchema.statics.checkDuplicateName = async function (
  studentId,
  firstName,
  lastName,
  excludeId = null
) {
  if (!firstName || !lastName) return null;

  const query = {
    student: studentId,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    isDeleted: false,
    kycStatus: "verified",
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return await this.findOne(query).select(
    "firstName lastName email phoneNumber kycStatus"
  );
};

CoBorrowerSchema.methods.updateFinancialSummary = function () {
  if (!this.financialAnalysis) return;

  const analysis = this.financialAnalysis;
  const foir = analysis.foir || {};
  const cibil = analysis.cibil || {};
  const extracted = analysis.extractedData || {};
  const salary = extracted.salary_slips || {};
  const itr = extracted.itr || {};
  const bank = extracted.bank_statement || {};

  this.financialSummary = {
    avgMonthlySalary: salary.average_net_salary || 0,
    avgMonthlyIncome: itr.average_monthly_income || 0,
    estimatedAnnualIncome: itr.average_annual_income || 0,
    totalExistingEmi: bank.average_monthly_emi || foir.total_monthly_emi || 0,

    // ✅ ADD THESE 5 MAPPINGS:
    avgBankBalance: bank.average_monthly_balance || 0,
    minBankBalance: bank.minimum_balance || 0,
    bounceCount: bank.bounce_count || 0,
    dishonorCount: bank.dishonor_count || 0,
    insufficientFundIncidents: bank.insufficient_fund_incidents || 0,

    foir: foir.foir_percentage || 0,
    foirStatus: foir.foir_status || "unknown",
    cibilEstimate: cibil.estimated_score || cibil.estimatedScore || 0,
    cibilRiskLevel: cibil.risk_level || cibil.riskLevel || "unknown",
    incomeStability:
      salary.salary_consistency_months > 0 ? "stable" : "unstable",
    overallScore: analysis.quality?.overall_confidence || 0,
    documentCompleteness: {
      hasKYC: this.kycStatus === "verified",
      hasSalarySlips: analysis.documents_processed?.salary_slips || false,
      hasBankStatement: analysis.documents_processed?.bank_statement || false,
      hasITR: analysis.documents_processed?.itr1 || false,
      hasForm16: analysis.documents_processed?.form16 || false,
      completenessScore: this.calculateCompletenessScore(),
    },
    verificationStatus: this.financialVerificationStatus,
    lastUpdated: new Date(),
    nextAction: this.determineNextAction(),
  };

  this.markModified("financialSummary");
};

CoBorrowerSchema.methods.calculateCompletenessScore = function () {
  let score = 0;
  if (this.kycStatus === "verified") score += 20;
  if (this.financialDocuments?.salarySlips?.status === "completed") score += 20;
  if (this.financialDocuments?.bankStatement?.status === "completed")
    score += 20;
  if (this.financialDocuments?.itr1?.status === "completed") score += 20;
  if (this.financialDocuments?.form16?.status === "completed") score += 20;
  return score;
};

CoBorrowerSchema.methods.determineNextAction = function () {
  if (this.kycStatus !== "verified") return "complete_kyc";
  if (this.financialDocuments?.salarySlips?.status !== "completed")
    return "upload_salary_slips";
  if (this.financialDocuments?.bankStatement?.status !== "completed")
    return "upload_bank_statement";
  if (this.financialDocuments?.itr1?.status !== "completed")
    return "upload_itr";
  if (this.financialVerificationStatus === "pending")
    return "process_documents";
  if (this.financialVerificationStatus === "verified")
    return "application_complete";
  return "complete_profile";
};

CoBorrowerSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
};

module.exports = mongoose.model("CoBorrower", CoBorrowerSchema);
