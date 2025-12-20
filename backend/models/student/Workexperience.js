// models/student/WorkExperience.js
const mongoose = require("mongoose");

// Employment Type Enum - matches Python agent
const employmentTypeEnum = [
  "full_time",
  "part_time",
  "contract",
  "internship_paid",
  "internship_unpaid",
  "freelance",
  "volunteer",
  "temporary",
];

// Document Type Enum
const documentTypeEnum = [
  "experience_letter",
  "offer_letter",
  "relieving_letter",
  "salary_slip",
  "appointment_letter",
  "other",
];

// Single Work Experience Schema
const singleExperienceSchema = new mongoose.Schema(
  {
    // ========== BASIC INFO ==========
    companyName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    jobTitle: {
      type: String,
      trim: true,
      maxlength: 150,
    },
    employmentType: {
      type: String,
      enum: employmentTypeEnum,
      default: "full_time",
    },

    // ========== DATES ==========
    startDate: {
      type: String, // DD/MM/YYYY format from Python
      default: null,
    },
    endDate: {
      type: String, // DD/MM/YYYY format from Python
      default: null,
    },
    currentlyWorking: {
      type: Boolean,
      default: false,
    },

    // ========== COMPENSATION ==========
    isPaid: {
      type: Boolean,
      default: true,
    },
    stipendAmount: {
      type: Number,
      min: 0,
      default: null,
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
    notes: {
      type: String,
      default: null,
    },

    // ========== SOURCE DOCUMENT ==========
    sourceDocumentType: {
      type: String,
      enum: documentTypeEnum,
      default: "experience_letter",
    },
    hasExperienceLetter: {
      type: Boolean,
      default: false,
    },

    // ========== CLOUDINARY DOCUMENT ==========
    documentUrl: {
      type: String,
      default: null,
    },
    documentPublicId: {
      type: String,
      default: null,
    },
    documentResourceType: {
      type: String,
      default: "raw",
    },
    documentType: {
      type: String,
      default: "authenticated",
    },

    // ========== EXTRACTED RAW DATA ==========
    extractedData: {
      type: mongoose.Schema.Types.Mixed,
      select: false, // Don't include in queries by default
    },
  },
  { _id: true }
);

// Verification Result Schema
const verificationSchema = new mongoose.Schema(
  {
    valid: {
      type: Boolean,
      default: false,
    },
    confidence: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "low",
    },
    reason: {
      type: String,
      default: "",
    },
    issues: {
      type: [String],
      default: [],
    },
    warnings: {
      type: [String],
      default: [],
    },
    hasMandatoryDocuments: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

// Document Info Schema
const documentInfoSchema = new mongoose.Schema(
  {
    filename: String,
    path: String,
    extension: String,
    sizeMb: Number,
    pageCount: {
      type: Number,
      default: 0,
    },
    qualityScore: {
      type: Number,
      default: 0,
    },
    documentType: {
      type: String,
      enum: documentTypeEnum,
      default: "other",
    },
    isMandatory: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

// Main Work Experience Record Schema
const workExperienceRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
      unique: true, // One record per user
    },

    // ========== SESSION INFO ==========
    sessionId: {
      type: String,
      required: true,
    },
    processingTimestamp: {
      type: Date,
      default: Date.now,
    },

    // ========== WORK EXPERIENCES ==========
    workExperiences: {
      type: [singleExperienceSchema],
      default: [],
    },
    verifications: {
      type: [verificationSchema],
      default: [],
    },
    documents: {
      type: [documentInfoSchema],
      default: [],
    },

    // ========== SUMMARY STATISTICS ==========
    totalDocuments: {
      type: Number,
      default: 0,
    },
    mandatoryDocumentsCount: {
      type: Number,
      default: 0,
    },
    optionalDocumentsCount: {
      type: Number,
      default: 0,
    },
    validExperiences: {
      type: Number,
      default: 0,
    },
    totalYearsExperience: {
      type: Number,
      default: null,
    },

    // ========== MANDATORY DOCUMENT VALIDATION ==========
    hasAllMandatoryDocuments: {
      type: Boolean,
      default: false,
    },
    missingMandatoryDocuments: {
      type: [String],
      default: [],
    },

    // ========== PROCESSING METADATA ==========
    processingTimeSeconds: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ["success", "partial", "failed", "pending"],
      default: "pending",
    },
    errors: {
      type: [String],
      default: [],
    },

    // ========== AI PROCESSING METADATA ==========
    aiProcessingMetadata: {
      modelUsed: {
        type: String,
        default: "gemini-2.5-flash",
      },
      extractionMethod: {
        type: String,
        default: "work-experience-agent-v1",
      },
      processingErrors: {
        type: [String],
        default: [],
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
workExperienceRecordSchema.index({ user: 1 });
workExperienceRecordSchema.index({ status: 1 });
workExperienceRecordSchema.index({ sessionId: 1 });
workExperienceRecordSchema.index({ createdAt: -1 });

// Virtual: Status color
workExperienceRecordSchema.virtual("statusColor").get(function () {
  const colors = {
    success: "#10b981",
    partial: "#f59e0b",
    failed: "#ef4444",
    pending: "#6b7280",
  };
  return colors[this.status] || "#6b7280";
});

// Virtual: Has valid experiences
workExperienceRecordSchema.virtual("hasValidExperiences").get(function () {
  return this.validExperiences > 0;
});

// Virtual: Completion percentage
workExperienceRecordSchema.virtual("completionPercentage").get(function () {
  if (this.workExperiences.length === 0) return 0;
  return Math.round(
    (this.validExperiences / this.workExperiences.length) * 100
  );
});

// Method: Update verification status
workExperienceRecordSchema.methods.updateVerificationStatus = function () {
  // Count valid experiences with experience letters
  this.validExperiences = this.workExperiences.filter(
    (exp, i) => this.verifications[i]?.valid && exp.hasExperienceLetter
  ).length;

  // Check mandatory documents
  this.hasAllMandatoryDocuments = this.mandatoryDocumentsCount > 0;

  // Update status
  if (!this.hasAllMandatoryDocuments) {
    this.status = "failed";
  } else if (this.validExperiences > 0) {
    this.status = "success";
  } else if (this.workExperiences.length > 0) {
    this.status = "partial";
  } else {
    this.status = "failed";
  }
};

// Pre-save middleware - Fixed for Mongoose 9.x
workExperienceRecordSchema.pre("save", async function () {
  // Calculate total documents
  this.totalDocuments = this.documents.length;
  this.mandatoryDocumentsCount = this.documents.filter(
    (doc) => doc.isMandatory
  ).length;
  this.optionalDocumentsCount =
    this.totalDocuments - this.mandatoryDocumentsCount;

  // No need to call next() in async pre-save hooks in Mongoose 9+
});

// Static method: Get user's total experience
workExperienceRecordSchema.statics.getUserTotalExperience = async function (
  userId
) {
  const record = await this.findOne({ user: userId });
  if (!record) return 0;
  return record.totalYearsExperience || 0;
};

// Static method: Get user's valid experiences count
workExperienceRecordSchema.statics.getUserValidExperiencesCount =
  async function (userId) {
    const record = await this.findOne({ user: userId });
    if (!record) return 0;
    return record.validExperiences || 0;
  };

module.exports = mongoose.model(
  "WorkExperienceRecord",
  workExperienceRecordSchema
);
