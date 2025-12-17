// models/AdmissionLetter.js

const mongoose = require("mongoose");

const AdmissionLetterSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    // Cloudinary URL of the uploaded admission letter (image or PDF)
    // Required only when status is "verified"
    admissionLetterUrl: {
      type: String,
      required: function () {
        return this.status === "verified";
      },
    },

    // Overall status of this admission letter record
    status: {
      type: String,
      enum: ["verified", "failed", "pending"],
      default: "pending",
      index: true,
    },

    // High-level failure reason (for failed status)
    failureReason: {
      type: String,
    },

    // Detailed issues from validation and risk assessment
    validationIssues: [String],
    riskIssues: [String],

    // Core fields
    universityName: String,
    programName: String,
    intakeTerm: String, // e.g. "Fall", "Spring"
    intakeYear: Number,
    country: String,

    // AI evaluation
    universityScore: {
      type: Number, // 0–100
      min: 0,
      max: 100,
    },
    riskLevel: {
      type: String,
    },
    issuesFound: [String], // list of problems / red flags

    // Model metadata
    evaluationSource: {
      type: String,
      default: "gemini_plus_groq",
    },
    geminiSummary: String,
    groqSummary: String,

    // Raw structured extraction (flexible)
    extractedFields: {
      type: mongoose.Schema.Types.Mixed,
    },

    evaluatedAt: {
      type: Date,
      default: Date.now,
    },

    // Extra V2 metadata
    verificationLevel: String,
    universityReputation: mongoose.Schema.Types.Mixed,
    loanApprovalFactors: mongoose.Schema.Types.Mixed,
    strengths: [String],
    documentAuthenticity: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdmissionLetter", AdmissionLetterSchema);
