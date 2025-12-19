// models/NBFC.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const NBFCSchema = new mongoose.Schema(
  {
    // ===== BASIC PROFILE =====
    role: {
      type: String,
      default: "NBFC",
      immutable: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    brandName: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    phoneNumber: { type: String, unique: true, sparse: true },
    registrationNumber: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: "India" },
    },
    contactPerson: {
      name: String,
      designation: String,
      email: String,
      phone: String,
    },

    // Verification status
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isApprovedByAdmin: { type: Boolean, default: false },

    emailVerificationToken: { type: String, select: false },
    emailVerificationExpire: { type: Date, select: false },
    phoneVerificationMessageId: { type: String, select: false },
    phoneVerificationExpire: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpire: { type: Date, select: false },

    // ===== LOAN PARAMETERS CONFIGURATION =====
    loanConfig: {
      enabled: { type: Boolean, default: true },
      cibil: {
        minScore: { type: Number, min: 300, max: 900, default: 650 },
        allowOverdue: { type: Boolean, default: false },
        checkBounceInOwnBank: { type: Boolean, default: false },
      },
      foir: {
        maxPercentage: { type: Number, min: 0, max: 100, default: 75 },
        borderlineStart: { type: Number, min: 0, max: 100, default: 60 },
        actionWhenBorderline: {
          type: String,
          enum: ["Clarification", "Rejected", "Approved"],
          default: "Clarification",
        },
      },
      incomeItr: {
        itrRequired: { type: Boolean, default: true },
        minAnnualIncome: { type: Number, min: 0, default: 500000 },
        minMonthlySalary: { type: Number, min: 0 },
        itrYearsRequired: { type: Number, min: 0, max: 5, default: 2 },
      },
      bankBalance: {
        required: { type: Boolean, default: false },
        minAvgBalance: { type: Number, min: 0, default: 10000 },
        statementMonthsRequired: { type: Number, min: 0, max: 12, default: 6 },
      },
      academics: {
        minPercentage10th: { type: Number, min: 0, max: 100, default: 55 },
        minPercentage12th: { type: Number, min: 0, max: 100, default: 55 },
        minPercentageGrad: { type: Number, min: 0, max: 100, default: 55 },
        maxGapYears: { type: Number, min: 0, max: 10, default: 2 },
        gapYearsAction: {
          type: String,
          enum: ["Clarification", "Rejected", "Approved"],
          default: "Clarification",
        },
      },
      university: {
        rankingRequired: { type: Boolean, default: false },
        maxRankThreshold: { type: Number, min: 0 },
        unrankedAction: {
          type: String,
          enum: ["Clarification", "Rejected", "Approved"],
          default: "Rejected",
        },
        categorySystem: { type: Boolean, default: false },
      },
      loanToIncome: {
        maxMultiple: { type: Number, min: 0, default: 8 },
        unsecuredMinAmount: { type: Number, min: 0 },
        unsecuredMaxAmount: { type: Number, min: 0 },
      },
      collateral: {
        requiredAboveAmount: { type: Number, min: 0 },
        minCoverageMultiple: { type: Number, min: 0, default: 1.2 },
      },
      offerLetter: {
        required: { type: Boolean, default: true },
        canSanctionWithout: { type: Boolean, default: false },
      },
      tests: {
        greMinScore: { type: Number, min: 0 },
        ieltsMinScore: { type: Number, min: 0 },
        toeflMinScore: { type: Number, min: 0 },
        othersOptional: { type: Boolean, default: true },
      },
      coBorrower: {
        mandatory: { type: Boolean, default: true },
        allowedRelations: {
          type: [String],
          default: [
            "father",
            "mother",
            "brother",
            "sister",
            "spouse",
            "uncle",
            "aunt",
            "guardian",
          ],
        },
        relationByUniversityTier: { type: Boolean, default: false },
      },
      roi: {
        minRate: { type: Number, min: 0, default: 9.0 },
        maxRate: { type: Number, min: 0, default: 14.0 },
        currency: { type: String, default: "INR" },
      },
      negativeCourses: {
        type: [String],
        default: [],
      },
    },

    // Statistics
    stats: {
      totalApplications: { type: Number, default: 0 },
      approvedApplications: { type: Number, default: 0 },
      rejectedApplications: { type: Number, default: 0 },
      pendingApplications: { type: Number, default: 0 },
    },

    lastLogin: { type: Date },
  },
  { timestamps: true }
);

// Indexes
NBFCSchema.index({ email: 1 });
NBFCSchema.index({ companyName: 1 });
NBFCSchema.index({ phoneNumber: 1 });
NBFCSchema.index({ isActive: 1, isApprovedByAdmin: 1 });

// Hash password before save
NBFCSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password method
NBFCSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate OTP (6 digits)
NBFCSchema.methods.generateOTP = function () {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate verification token (for password reset)
NBFCSchema.methods.generateVerificationToken = function () {
  return crypto.randomBytes(32).toString("hex");
};

// Generate email verification token
NBFCSchema.methods.generateEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

// Generate password reset token
NBFCSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpire = Date.now() + 60 * 60 * 1000; // 60 minutes
  return resetToken;
};

module.exports = mongoose.model("NBFC", NBFCSchema);
