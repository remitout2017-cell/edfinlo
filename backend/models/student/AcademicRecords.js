// models/AcademicRecords.js
const mongoose = require("mongoose");

// ========== CLASS 10 SCHEMA ==========
const class10Schema = new mongoose.Schema(
  {
    // Original extracted data
    boardName: { type: String, required: true },
    boardType: { type: String }, // cbse, icse, maharashtra, etc.
    yearOfPassing: { type: Number, required: true },
    rollNumber: String,
    schoolName: String,

    // Marks data
    percentage: { type: Number, min: 0, max: 100 },
    cgpa: { type: Number, min: 0, max: 10 },
    cgpaScale: { type: Number, default: 10 },
    grade: String,
    division: String,

    // Standardized/Converted data
    universalGrade: { type: String }, // A1, A2, B1, etc.
    normalizedPercentage: { type: Number },
    conversionInfo: {
      method: String,
      original: String,
    },

    // Document metadata
    documentUrl: { type: String, required: true },
    documentPublicId: { type: String, select: false },
    documentResourceType: { type: String, default: "raw", select: false },
    documentType: { type: String, default: "authenticated", select: false },

    // Extraction metadata
    extractionStatus: {
      type: String,
      enum: ["success", "failed", "manual_review", "pending"],
      default: "pending",
    },
    extractionConfidence: { type: Number, min: 0, max: 1 },
    extractedAt: Date,
    extractedData: { type: Object, select: false }, // Full AI response

    isVerified: { type: Boolean, default: false },
    verificationNotes: String,
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ========== CLASS 12 SCHEMA ==========
const class12Schema = new mongoose.Schema(
  {
    boardName: { type: String, required: true },
    yearOfPassing: { type: Number, required: true },
    stream: String, // Science, Commerce, Arts
    schoolName: String,

    // Marks data
    percentage: { type: Number, min: 0, max: 100 },
    cgpa: { type: Number, min: 0, max: 10 },
    grade: String,
    convertedGrade: String, // Standardized grade

    // Document metadata
    documentUrl: { type: String, required: true },
    documentPublicId: { type: String, select: false },
    documentResourceType: { type: String, default: "raw", select: false },
    documentType: { type: String, default: "authenticated", select: false },

    // Extraction metadata
    extractionStatus: {
      type: String,
      enum: ["success", "failed", "manual_review", "pending"],
      default: "pending",
    },
    extractionConfidence: { type: Number, min: 0, max: 1 },
    extractedAt: Date,
    extractedData: { type: Object, select: false },

    isVerified: { type: Boolean, default: false },
    verificationNotes: String,
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ========== GRADUATION SEMESTER SCHEMA ==========
const graduationSemesterSchema = new mongoose.Schema(
  {
    semesterYear: { type: String, required: true }, // "Semester 1", "Year 2"
    yearOfCompletion: Number,
    percentage: { type: Number, min: 0, max: 100 },
    cgpa: { type: Number, min: 0, max: 10 },
    grade: String,
  },
  { _id: false }
);

// ========== GRADUATION SCHEMA ==========
const graduationSchema = new mongoose.Schema(
  {
    institutionName: { type: String, required: true },
    degree: { type: String, required: true }, // B.Tech, B.Sc, etc.
    specialization: String, // Computer Science, etc.
    yearOfPassing: { type: Number, required: true },
    durationYears: Number,

    // Semester-wise data
    semesters: [graduationSemesterSchema],

    // Overall marks
    finalPercentage: { type: Number, min: 0, max: 100 },
    finalCgpa: { type: Number, min: 0, max: 10 },
    convertedGrade: String,

    // Document metadata
    documentUrl: { type: String, required: true },
    documentPublicId: { type: String, select: false },
    documentResourceType: { type: String, default: "raw", select: false },
    documentType: { type: String, default: "authenticated", select: false },

    // Extraction metadata
    extractionStatus: {
      type: String,
      enum: ["success", "failed", "manual_review", "pending"],
      default: "pending",
    },
    extractionConfidence: { type: Number, min: 0, max: 1 },
    extractedAt: Date,
    extractedData: { type: Object, select: false },

    isVerified: { type: Boolean, default: false },
    verificationNotes: String,
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ========== EDUCATION GAP SCHEMA ==========
const educationGapSchema = new mongoose.Schema(
  {
    gapType: {
      type: String,
      enum: ["after_10th", "after_12th", "during_graduation"],
      required: true,
    },
    gapYears: { type: Number, required: true },
    fromEducation: String,
    toEducation: String,
    isSignificant: Boolean, // > 1 year
    explanation: String,
  },
  { _id: false }
);

// ========== GAP ANALYSIS SCHEMA ==========
const gapAnalysisSchema = new mongoose.Schema(
  {
    hasGaps: { type: Boolean, default: false },
    totalGaps: { type: Number, default: 0 },
    gaps: [educationGapSchema],
    overallAssessment: String,
    timelineConsistent: Boolean,
    analyzedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ========== MAIN ACADEMIC RECORDS SCHEMA ==========
const academicRecordsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      unique: true,
    },

    // Academic data
    class10: class10Schema,
    class12: class12Schema,
    graduation: graduationSchema,

    // Gap analysis
    gapAnalysis: gapAnalysisSchema,

    // Overall status
    overallVerificationStatus: {
      type: String,
      enum: ["pending", "partial", "complete", "manual_review"],
      default: "pending",
    },

    processingStatus: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "failed"],
      default: "not_started",
    },

    processingTimeSeconds: Number,
    lastVerifiedAt: Date,

    // AI processing metadata
    aiProcessingMetadata: {
      sessionId: String,
      modelUsed: String,
      totalDocumentsProcessed: Number,
      processingErrors: [String],
    },
  },
  { timestamps: true }
);

// Indexes
academicRecordsSchema.index({ user: 1 });
academicRecordsSchema.index({ "class10.yearOfPassing": 1 });
academicRecordsSchema.index({ "class12.yearOfPassing": 1 });
academicRecordsSchema.index({ "graduation.degree": 1 });
academicRecordsSchema.index({ overallVerificationStatus: 1 });
academicRecordsSchema.index({ processingStatus: 1 });

// Update verification status method
academicRecordsSchema.methods.updateVerificationStatus = function () {
  const hasClass10 = this.class10?.isVerified;
  const hasClass12 = this.class12?.isVerified;
  const hasGraduation = this.graduation?.isVerified;

  if (hasClass10 && hasClass12 && hasGraduation) {
    this.overallVerificationStatus = "complete";
  } else if (hasClass10 || hasClass12 || hasGraduation) {
    this.overallVerificationStatus = "partial";
  } else {
    this.overallVerificationStatus = "pending";
  }

  this.lastVerifiedAt = new Date();
};

module.exports = mongoose.model("AcademicRecords", academicRecordsSchema);
