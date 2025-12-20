// models/student/TestScores.js
const mongoose = require("mongoose");

// ========== SUB-SCHEMAS ==========

const TOEFLScoreSchema = new mongoose.Schema(
  {
    // Section Scores
    reading: { type: Number, min: 0, max: 30 },
    listening: { type: Number, min: 0, max: 30 },
    speaking: { type: Number, min: 0, max: 30 },
    writing: { type: Number, min: 0, max: 30 },
    totalScore: { type: Number, min: 0, max: 120 },

    // Test Details
    testDate: { type: Date },
    registrationNumber: { type: String },
    testCenter: { type: String },
    scoreValidityDate: { type: Date },

    // Document Storage
    documentUrl: { type: String, required: true },
    documentPublicId: { type: String, required: true },
    documentResourceType: { type: String, default: "raw" },
    documentType: { type: String, default: "authenticated" },

    // Extraction Metadata
    extractionStatus: {
      type: String,
      enum: ["success", "partial", "failed"],
      default: "success",
    },
    extractionConfidence: { type: Number, min: 0, max: 1, default: 0 },
    extractedAt: { type: Date, default: Date.now },

    // Verification Results
    isVerified: { type: Boolean, default: false },
    verificationIssues: [{ type: String }],
    verificationWarnings: [{ type: String }],

    // Raw extraction data (for debugging)
    extractedData: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const GREScoreSchema = new mongoose.Schema(
  {
    // Section Scores
    verbalReasoning: { type: Number, min: 130, max: 170 },
    quantitativeReasoning: { type: Number, min: 130, max: 170 },
    analyticalWriting: { type: Number, min: 0.0, max: 6.0 },

    // Test Details
    testDate: { type: Date },
    registrationNumber: { type: String },
    testCenter: { type: String },
    scoreValidityDate: { type: Date },

    // Document Storage
    documentUrl: { type: String, required: true },
    documentPublicId: { type: String, required: true },
    documentResourceType: { type: String, default: "raw" },
    documentType: { type: String, default: "authenticated" },

    // Extraction Metadata
    extractionStatus: {
      type: String,
      enum: ["success", "partial", "failed"],
      default: "success",
    },
    extractionConfidence: { type: Number, min: 0, max: 1, default: 0 },
    extractedAt: { type: Date, default: Date.now },

    // Verification Results
    isVerified: { type: Boolean, default: false },
    verificationIssues: [{ type: String }],
    verificationWarnings: [{ type: String }],

    // Raw extraction data
    extractedData: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const IELTSScoreSchema = new mongoose.Schema(
  {
    // Band Scores
    listening: { type: Number, min: 0.0, max: 9.0 },
    reading: { type: Number, min: 0.0, max: 9.0 },
    writing: { type: Number, min: 0.0, max: 9.0 },
    speaking: { type: Number, min: 0.0, max: 9.0 },
    overallBandScore: { type: Number, min: 0.0, max: 9.0 },

    // Test Details
    testDate: { type: Date },
    candidateNumber: { type: String },
    testCenter: { type: String },
    testReportFormNumber: { type: String },
    testType: { type: String, enum: ["Academic", "General Training"] },

    // Document Storage
    documentUrl: { type: String, required: true },
    documentPublicId: { type: String, required: true },
    documentResourceType: { type: String, default: "raw" },
    documentType: { type: String, default: "authenticated" },

    // Extraction Metadata
    extractionStatus: {
      type: String,
      enum: ["success", "partial", "failed"],
      default: "success",
    },
    extractionConfidence: { type: Number, min: 0, max: 1, default: 0 },
    extractedAt: { type: Date, default: Date.now },

    // Verification Results
    isVerified: { type: Boolean, default: false },
    verificationIssues: [{ type: String }],
    verificationWarnings: [{ type: String }],

    // Raw extraction data
    extractedData: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

// ========== MAIN SCHEMA ==========

const TestScoresSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      unique: true,
    },

    // Test Scores (only one will be populated per user typically)
    toeflScore: TOEFLScoreSchema,
    greScore: GREScoreSchema,
    ieltsScore: IELTSScoreSchema,

    // Processing Status
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "partial"],
      default: "pending",
    },

    processingTimeSeconds: { type: Number },

    // AI Processing Metadata
    aiProcessingMetadata: {
      sessionId: String,
      modelUsed: String,
      extractionEngine: { type: String, default: "gemini-2.0-flash-exp" },
      verificationEngine: { type: String, default: "llama-3.3-70b" },
      processingErrors: [String],
    },

    // Timestamps
    lastUpdated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ========== INDEXES ==========
TestScoresSchema.index({ user: 1 });
TestScoresSchema.index({ "toeflScore.testDate": 1 });
TestScoresSchema.index({ "greScore.testDate": 1 });
TestScoresSchema.index({ "ieltsScore.testDate": 1 });

// ========== VIRTUALS ==========

TestScoresSchema.virtual("hasValidTOEFL").get(function () {
  if (!this.toeflScore?.testDate) return false;
  const validityYears = 2;
  const expiryDate = new Date(this.toeflScore.testDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + validityYears);
  return new Date() <= expiryDate;
});

TestScoresSchema.virtual("hasValidGRE").get(function () {
  if (!this.greScore?.testDate) return false;
  const validityYears = 5;
  const expiryDate = new Date(this.greScore.testDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + validityYears);
  return new Date() <= expiryDate;
});

TestScoresSchema.virtual("hasValidIELTS").get(function () {
  if (!this.ieltsScore?.testDate) return false;
  const validityYears = 2;
  const expiryDate = new Date(this.ieltsScore.testDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + validityYears);
  return new Date() <= expiryDate;
});

// ========== METHODS ==========

TestScoresSchema.methods.updateProcessingStatus = function () {
  const scores = [this.toeflScore, this.greScore, this.ieltsScore].filter(
    Boolean
  );

  if (scores.length === 0) {
    this.processingStatus = "pending";
  } else if (scores.every((s) => s.isVerified)) {
    this.processingStatus = "completed";
  } else if (scores.some((s) => s.extractionStatus === "failed")) {
    this.processingStatus = "failed";
  } else {
    this.processingStatus = "partial";
  }

  this.lastUpdated = new Date();
};

// ========== MIDDLEWARE ==========

TestScoresSchema.pre("save", function (next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model("TestScores", TestScoresSchema);
