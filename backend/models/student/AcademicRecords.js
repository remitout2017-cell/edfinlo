// models/AcademicRecords.js
const mongoose = require("mongoose");

const marksheetSchema = new mongoose.Schema({
  documentUrl: { type: String, required: true },
  institutionName: { type: String },
  boardUniversity: { type: String },
  yearOfPassing: { type: Number },
  percentage: { type: Number, min: 0, max: 100 },
  cgpa: { type: Number, min: 0, max: 10 },
  grade: { type: String },
  
  // Extraction metadata
  extractionStatus: {
    type: String,
    enum: ["success", "failed", "manual_review", "pending"],
    default: "pending",
  },
  extractionConfidence: { type: Number, min: 0, max: 1, default: 0 },
  extractedAt: { type: Date, default: Date.now },
  extractedData: { 
    type: Object,
    select: false  // ✅ ADD THIS - Won't be returned in queries by default
  },
  verificationReason: String,
}, { _id: true });

// Class 10 structure
const class10Schema = new mongoose.Schema(
  {
    marksheets: [marksheetSchema],
    isVerified: { type: Boolean, default: false },
    verificationNotes: String,
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Class 12 structure
const class12Schema = new mongoose.Schema(
  {
    marksheets: [marksheetSchema],
    stream: { type: String }, // Science, Commerce, Arts
    isVerified: { type: Boolean, default: false },
    verificationNotes: String,
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ✅ Universal Higher Education Schema
const higherEducationSchema = new mongoose.Schema(
  {
    educationType: {
      type: String,
      required: true,
      enum: [
        "diploma",
        "associate",
        "bachelor",
        "bachelors",
        "postgraduate_diploma",
        "master",
        "masters",
        "phd",
        "doctorate",
        "certificate",
        "professional",
        "vocational",
        "other",
      ],
    },
    courseName: { type: String, required: true }, // ✅ Universal course name
    specialization: String, // Computer Science, Mechanical, etc.
    duration: String, // "2 years", "4 years", etc.
    marksheets: [marksheetSchema],
    isVerified: { type: Boolean, default: false },
    verificationNotes: String,
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Main Academic Records Schema
const academicRecordsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      unique: true,
    },
    class10: class10Schema,
    class12: class12Schema,
    higherEducation: [higherEducationSchema],

    // Overall verification status
    overallVerificationStatus: {
      type: String,
      enum: ["pending", "partial", "complete", "manual_review"],
      default: "pending",
    },
    lastVerifiedAt: Date,
  },
  { timestamps: true }
);

// Indexes
academicRecordsSchema.index({ user: 1 });
academicRecordsSchema.index({ "higherEducation.educationType": 1 });

// Method to remove higher education entry
academicRecordsSchema.methods.removeHigherEducation = async function (
  educationId
) {
  this.higherEducation = this.higherEducation.filter(
    (edu) => edu._id.toString() !== educationId
  );
  await this.save();
  return this;
};

// Update verification status
academicRecordsSchema.methods.updateVerificationStatus = function () {
  const hasClass10 = this.class10?.isVerified;
  const hasClass12 = this.class12?.isVerified;
  const hasHigherEd = this.higherEducation.some((edu) => edu.isVerified);

  if (hasClass10 && hasClass12 && hasHigherEd) {
    this.overallVerificationStatus = "complete";
  } else if (hasClass10 || hasClass12 || hasHigherEd) {
    this.overallVerificationStatus = "partial";
  } else {
    this.overallVerificationStatus = "pending";
  }

  this.lastVerifiedAt = new Date();
};
academicRecordsSchema.index({ "higherEducation.courseName": 1 });

module.exports = mongoose.model("AcademicRecords", academicRecordsSchema);
