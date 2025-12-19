// models/student/students.js
const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const StudentSchema = new mongoose.Schema(
  {
    role: { type: String, default: "student" },

    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    profilePicture: String,

    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },

    phoneNumber: { type: String, unique: true, sparse: true },

    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    emailVerificationToken: { type: String, select: false },
    emailVerificationExpire: { type: Date, select: false },

    phoneVerificationMessageId: { type: String, select: false },
    phoneVerificationExpire: { type: Date, select: false },

    passwordResetToken: { type: String, select: false },
    passwordResetExpire: { type: Date, select: false },

    kycVerificationMethod: { type: String, required: false },

    kycData: {
      // URLs (private)
      aadhaarFrontUrl: { type: String, select: false },
      aadhaarBackUrl: { type: String, select: false },
      panCardUrl: { type: String, select: false },
      panCardBackUrl: { type: String, select: false },
      passportUrl: { type: String, select: false },

      // Cloudinary delete identifiers (private) [web:48]
      aadhaarFrontPublicId: { type: String, select: false },
      aadhaarBackPublicId: { type: String, select: false },
      panFrontPublicId: { type: String, select: false },
      passportPublicId: { type: String, select: false },

      aadhaarFrontResourceType: {
        type: String,
        default: "image",
        select: false,
      },
      aadhaarBackResourceType: {
        type: String,
        default: "image",
        select: false,
      },
      panFrontResourceType: { type: String, default: "image", select: false },
      passportResourceType: { type: String, default: "image", select: false },

      aadhaarFrontType: {
        type: String,
        default: "authenticated",
        select: false,
      },
      aadhaarBackType: {
        type: String,
        default: "authenticated",
        select: false,
      },
      panFrontType: { type: String, default: "authenticated", select: false },
      passportType: { type: String, default: "authenticated", select: false },

      // Encrypted sensitive fields (private) [file:69]
      aadhaarNumber: { type: String, select: false },
      panNumber: { type: String, select: false },
      passportNumber: { type: String, select: false },

      // Non-sensitive metadata
      aadhaarName: String,
      aadhaarDOB: Date,
      aadhaarAddress: String,
      aadhaarGender: String,

      panName: String,
      panDOB: Date,
      panFatherName: String,

      passportName: String,
      passportDOB: Date,
      passportIssueDate: Date,
      passportExpiryDate: Date,
      passportPlaceOfIssue: String,
      passportPlaceOfBirth: String,

      verificationSource: { type: String, default: "kyc-python-service" },
      lastVerifiedAt: Date,

      failureCount: { type: Number, default: 0 },
      failedAt: { type: Date, default: null },

      extractedData: { type: Object, select: false },

      verificationConfidence: { type: Number, min: 0, max: 100 },
      verificationLevel: String,
      verificationReason: String,
      validationScore: Number,

      extractionMetadata: Object,
      documentCompleteness: Object,
      identityConfirmation: Object,
      complianceChecks: Object,
      riskAssessment: Object,
      validationIssues: [String],
      verificationIssues: [String],
    },

    kycStatus: {
      type: String,
      default: "pending",
      enum: ["pending", "verified", "rejected", "manual_review"],
    },
    kycVerifiedAt: Date,
    kycRejectedAt: Date,

    academicRecords: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicRecords",
    },
    workExperience: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workexperience",
    },

    coBorrowers: [{ type: mongoose.Schema.Types.ObjectId, ref: "CoBorrower" }],
    admissionLetters: [
      { type: mongoose.Schema.Types.ObjectId, ref: "AdmissionLetter" },
    ],

    studyPlan: {
      targetCountry: { type: String, trim: true },
      targetCourse: { type: String, trim: true },
      courseDurationMonths: { type: Number, min: 1, max: 120 },
      requestedLoanAmount: { type: Number, min: 0 },
      intakeMonth: {
        type: String,
        enum: [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ],
      },
      intakeYear: { type: Number, min: 2024, max: 2030 },
      universityName: String,
      programLevel: {
        type: String,
        enum: [
          "Undergraduate",
          "Postgraduate",
          "Masters",
          "PhD",
          "Diploma",
          "Certificate",
        ],
      },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },

    consultant: { type: mongoose.Schema.Types.ObjectId, ref: "Consultant" },
    lastLogin: Date,
  },
  { timestamps: true }
);

// Indexes
StudentSchema.index({ email: 1 }, { unique: true });
StudentSchema.index({ phoneNumber: 1 }, { sparse: true });
StudentSchema.index({ kycStatus: 1 });
StudentSchema.index({ "studyPlan.targetCountry": 1 });
StudentSchema.index({ "studyPlan.requestedLoanAmount": 1 });
StudentSchema.index({ kycStatus: 1, isActive: 1 });
StudentSchema.index({
  "studyPlan.targetCountry": 1,
  "studyPlan.intakeYear": 1,
});

// OTP
StudentSchema.methods.generateOTP = function () {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

StudentSchema.methods.generateVerificationToken = function () {
  return crypto.randomBytes(32).toString("hex");
};

// Password hashing
StudentSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

StudentSchema.pre("save", function () {
  if (this.isModified("studyPlan") && this.studyPlan) {
    this.studyPlan.updatedAt = new Date();
  }
});

StudentSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Student", StudentSchema);
