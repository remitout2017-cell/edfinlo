// models/CoBorrower.js - FIXED SCHEMA
const mongoose = require("mongoose");

// KYC Verification Schema
const kycVerificationSchema = new mongoose.Schema(
  {
    verified: { type: Boolean, default: false },
    confidence: { type: Number, min: 0, max: 1 },
    verificationDate: Date,
    method: String,
    issues: [String],
    matches: {
      name: Boolean,
      dob: Boolean,
      overall: Boolean,
    },
  },
  { _id: false }
);

// Document Processing Metadata
const processingMetadataSchema = new mongoose.Schema(
  {
    extractedAt: Date,
    aiModel: String,
    confidence: { type: Number, min: 0, max: 1 },
    extractionQuality: String,
    processingTime: Number,
    retryCount: { type: Number, default: 0 },
  },
  { _id: false }
);

// CoBorrower Schema
const CoBorrowerSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    // Basic Information
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    relationToStudent: {
      type: String,
      required: true,
    },
    email: { type: String, trim: true, lowercase: true },
    phoneNumber: { type: String, trim: true },
    dateOfBirth: Date,

    // KYC Information
    kycData: {
      aadhaarFrontUrls: [String],
      aadhaarBackUrls: [String],
      panFrontUrls: [String],
      panBackUrls: [String],
      aadhaarNumber: { type: String, select: false },
      panNumber: { type: String, select: false },
      aadhaarName: String,
      aadhaarDOB: Date,
      aadhaarGender: String,
      aadhaarAddress: String,
      panName: String,
      panFatherName: String,
      panDOB: Date,
      verification: kycVerificationSchema,
      processingMetadata: processingMetadataSchema,
      lastVerifiedAt: Date,
    },

    kycStatus: {
      type: String,
      default: "pending",
    },
    kycVerifiedAt: Date,

    // Financial Information
    financialInfo: {
      salarySlips: [
        {
          month: String,
          year: Number,
          employerName: String,
          employeeName: String,
          employeeId: String,
          designation: String,
          paymentDate: {
            type: Date,
            set: function (v) {
              // Allow null/undefined
              if (!v) return v;

              // If it's already a Date, keep it as-is
              if (v instanceof Date) return v;

              // Handle string formats like "28/02/2025" or "28-02-2025"
              if (typeof v === "string") {
                const m = v.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
                if (m) {
                  const [, dd, mm, yyyy] = m;
                  const day = parseInt(dd, 10);
                  const month = parseInt(mm, 10) - 1;
                  const year = parseInt(yyyy, 10);
                  return new Date(year, month, day);
                }

                // Fallback: let JS Date try to parse
                const parsed = new Date(v);
                if (!isNaN(parsed.getTime())) return parsed;
              }

              // If nothing worked, just return original value (Mongoose will handle/validate)
              return v;
            },
          },
          basicSalary: Number,
          hra: Number,
          conveyanceAllowance: Number,
          medicalAllowance: Number,
          specialAllowance: Number,
          otherAllowances: Number,
          grossSalary: Number,
          providentFund: Number,
          professionalTax: Number,
          incomeTax: Number,
          otherDeductions: Number,
          netSalary: Number,
          totalEarnings: Number,
          totalDeductions: Number,
          documentUrls: [String],
          processingMetadata: processingMetadataSchema,
          isConsistent: Boolean,
          salaryStability: String,
          uploadedAt: Date,
        },
      ],

      bankStatement: {
        status: {
          type: String,
          default: "pending",
        },
        accountDetails: {
          accountNumber: String,
          bankName: String,
          ifscCode: String,
          accountType: String,
          accountHolderName: String,
          branch: String,
        },
        statementPeriod: {
          from: String,
          to: String,
        },
        monthlyAnalysis: [
          {
            month: String,
            year: Number,
            summary: {
              openingBalance: Number,
              closingBalance: Number,
              totalCredits: Number,
              totalDebits: Number,
              netFlow: Number,
              minBalance: Number,
              maxBalance: Number,
              averageBalance: Number,
            },
            salaryCredits: [
              {
                date: String,
                amount: Number,
                description: String,
                isRegular: Boolean,
              },
            ],
            emiDebits: [
              {
                date: String,
                amount: Number,
                description: String,
                counterparty: String,
              },
            ],
            bouncedTransactions: Number,
            returnCharges: Number,
            transactionCount: Number,
          },
        ],
        overallAnalysis: {
          averageMonthlyBalance: Number,
          salaryConsistency: {
            present: Boolean,
            regularity: String,
            averageAmount: Number,
            variance: Number,
          },
          emiObligations: {
            totalMonthlyEMI: Number,
            numberOfLoans: Number,
            largestEMI: Number,
          },
          cashFlow: {
            avgMonthlyCredits: Number,
            avgMonthlyDebits: Number,
            savingsRate: Number,
          },
          riskIndicators: {
            bounceCount: Number,
            lowBalanceDays: Number,
            overdraftUsage: Number,
          },
          behaviorScore: Number,
        },
        enhancedAnalysis: {
          loanEligibility: {
            eligibleAmount: Number,
            riskLevel: String,
            recommendedTenure: String,
          },
          incomeVerification: {
            verifiedIncome: Number,
            verificationMethod: String,
            confidence: Number,
          },
          financialHealth: {
            savingsRate: String,
            debtBurden: String,
            cashFlowStability: String,
          },
          redFlags: [String],
          strengths: [String],
        },
        documentUrls: [String],
        pageCount: Number,
        processingMetadata: processingMetadataSchema,
        extractedAt: Date,
        failureReason: String,
        failedAt: Date, // Added this field
      },

      itrData: [
        {
          assessmentYear: String,
          financialYear: String,
          panNumber: String,
          name: String,
          incomeFromSalary: Number,
          incomeFromHouseProperty: Number,
          incomeFromBusiness: Number,
          incomeFromCapitalGains: Number,
          incomeFromOtherSources: Number,
          grossTotalIncome: Number,
          deductions80C: Number,
          deductions80D: Number,
          deductions80E: Number,
          totalDeductions: Number,
          taxableIncome: Number,
          taxPayable: Number,
          taxPaid: Number,
          refundDue: Number,
          acknowledgmentNumber: String,
          filingDate: String,
          itrForm: String,
          documentUrls: [String],
          processingMetadata: processingMetadataSchema,
          isVerified: Boolean,
          hasAnnexures: Boolean,
          incomeGrowth: Number,
          incomeTrend: String,
          uploadedAt: Date,
        },
      ],

      form16Data: [
        {
          financialYear: String,
          assessmentYear: String,
          employerName: String,
          employerTAN: String,
          employerAddress: String,
          employeeName: String,
          employeePAN: String,
          grossSalary: Number,
          allowances: Number,
          perquisites: Number,
          profitsInLieuOfSalary: Number,
          totalSalary: Number,
          standardDeduction: Number,
          entertainmentAllowance: Number,
          professionalTax: Number,
          incomeUnderHeadSalary: Number,
          deductions80C: Number,
          deductions80CCC: Number,
          deductions80CCD: Number,
          deductions80D: Number,
          deductions80E: Number,
          deductions80G: Number,
          totalChapterVIADeductions: Number,
          totalIncome: Number,
          taxOnTotalIncome: Number,
          surcharge: Number,
          healthAndEducationCess: Number,
          totalTaxLiability: Number,
          reliefUnderSection89: Number,
          taxDeducted: Number,
          comparisonWithITR: {
            incomeMatch: Boolean,
            taxMatch: Boolean,
            discrepancies: [String],
            matchScore: Number,
            verificationStatus: String,
          },
          documentUrls: [String],
          processingMetadata: processingMetadataSchema,
          isComplete: Boolean,
          matchesITR: Boolean,
          verificationStatus: String,
          uploadedAt: Date,
        },
      ],

      financialSummary: {
        avgMonthlySalary: Number,
        avgMonthlyIncome: Number,
        estimatedAnnualIncome: Number,
        totalExistingEmi: Number,
        foir: Number,
        incomeSource: String,
        incomeStability: String,
        itrYearsCovered: Number,
        form16YearsCovered: Number,
        salarySlipCount: Number,
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
    },

    financialVerificationStatus: {
      type: String,
      default: "pending",
    },
    financialVerificationConfidence: { type: Number, min: 0, max: 1 },
    financialVerifiedAt: Date,
    financialVerificationIssues: [String],
    financialVerificationWarnings: [String],

    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: "India" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
CoBorrowerSchema.index({ student: 1, relationToStudent: 1 });
CoBorrowerSchema.index({ phoneNumber: 1 });
CoBorrowerSchema.index({ kycStatus: 1 });
CoBorrowerSchema.index({ financialVerificationStatus: 1 });
CoBorrowerSchema.index({ createdAt: -1 });

// Virtuals
CoBorrowerSchema.virtual("fullName").get(function () {
  return `${this.firstName || ""} ${this.lastName || ""}`.trim() || "Unknown";
});

CoBorrowerSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - this.dateOfBirth.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

// Pre-save middleware
CoBorrowerSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  if (this.financialInfo && (this.isNew || this.isModified("financialInfo"))) {
    try {
      this.calculateFinancialSummary();
    } catch (error) {
      console.error("Error calculating financial summary:", error);
    }
  }

  next();
});

// Methods
CoBorrowerSchema.methods.calculateFinancialSummary = function () {
  if (!this.financialInfo) {
    this.financialInfo = {};
  }

  const summary = {
    avgMonthlySalary: 0,
    avgMonthlyIncome: 0,
    estimatedAnnualIncome: 0,
    totalExistingEmi: 0,
    foir: 0,
    incomeSource: "other",
    incomeStability: "unstable",
    salarySlipCount: this.financialInfo.salarySlips?.length || 0,
    itrYearsCovered: this.financialInfo.itrData?.length || 0,
    form16YearsCovered: this.financialInfo.form16Data?.length || 0,
    documentCompleteness: {
      hasKYC: this.kycStatus === "verified",
      hasSalarySlips: this.financialInfo?.salarySlips?.length >= 3,
      hasBankStatement:
        this.financialInfo?.bankStatement?.status === "verified",
      hasITR: this.financialInfo?.itrData?.length >= 2,
      hasForm16: this.financialInfo?.form16Data?.length >= 2,
      completenessScore: 0,
    },
    verificationStatus: {
      kyc: this.kycStatus || "pending",
      income:
        this.financialInfo?.salarySlips?.length >= 3 ? "verified" : "pending",
      bank: this.financialInfo?.bankStatement?.status || "pending",
      overall: "pending",
    },
    lastUpdated: new Date(),
    nextAction: "upload_kyc",
  };

  let score = 0;
  if (summary.documentCompleteness.hasKYC) score += 20;
  if (summary.documentCompleteness.hasSalarySlips) score += 20;
  if (summary.documentCompleteness.hasBankStatement) score += 20;
  if (summary.documentCompleteness.hasITR) score += 20;
  if (summary.documentCompleteness.hasForm16) score += 20;
  summary.documentCompleteness.completenessScore = score;

  if (this.financialInfo.salarySlips?.length > 0) {
    const totalNet = this.financialInfo.salarySlips.reduce(
      (sum, slip) => sum + (slip.netSalary || 0),
      0
    );
    summary.avgMonthlySalary = Math.round(
      totalNet / this.financialInfo.salarySlips.length
    );
    summary.avgMonthlyIncome = summary.avgMonthlySalary;
    summary.incomeSource = "salaried";
    summary.incomeStability = this.financialInfo.salarySlips.every(
      (s) => s.isConsistent
    )
      ? "stable"
      : "moderate";
  }

  if (
    this.financialInfo.bankStatement?.overallAnalysis?.salaryConsistency
      ?.averageAmount
  ) {
    const bankIncome =
      this.financialInfo.bankStatement.overallAnalysis.salaryConsistency
        .averageAmount;
    if (bankIncome > summary.avgMonthlyIncome) {
      summary.avgMonthlyIncome = bankIncome;
    }
  }

  if (
    summary.avgMonthlyIncome === 0 &&
    this.financialInfo.itrData?.length > 0
  ) {
    const totalIncome = this.financialInfo.itrData.reduce(
      (sum, itr) => sum + (itr.taxableIncome || 0),
      0
    );
    summary.avgMonthlyIncome = Math.round(
      totalIncome / this.financialInfo.itrData.length / 12
    );
    summary.incomeSource = "self_employed";
  }

  if (
    this.financialInfo.bankStatement?.overallAnalysis?.emiObligations
      ?.totalMonthlyEMI
  ) {
    summary.totalExistingEmi =
      this.financialInfo.bankStatement.overallAnalysis.emiObligations.totalMonthlyEMI;
  }

  if (summary.avgMonthlyIncome > 0) {
    summary.estimatedAnnualIncome = Math.round(summary.avgMonthlyIncome * 12);
    summary.foir = parseFloat(
      ((summary.totalExistingEmi / summary.avgMonthlyIncome) * 100).toFixed(2)
    );
  }

  // FIXED: Use only "verified", "pending", or "failed" for overall
  const verifiedCount = Object.values(summary.verificationStatus).filter(
    (s) => s === "verified"
  ).length;
  if (verifiedCount >= 3) {
    summary.verificationStatus.overall = "verified";
    summary.nextAction = "complete";
  } else if (verifiedCount >= 1) {
    summary.verificationStatus.overall = "pending"; // Changed from "partial" to "pending"
    summary.nextAction = "upload_more_documents";
  } else {
    summary.verificationStatus.overall = "pending";
    summary.nextAction = "upload_kyc";
  }

  this.financialInfo.financialSummary = summary;
  this.markModified("financialInfo");
};

CoBorrowerSchema.methods.getAllDocumentUrls = function () {
  const urls = [];
  if (this.kycData) {
    if (this.kycData.aadhaarFrontUrls)
      urls.push(...this.kycData.aadhaarFrontUrls);
    if (this.kycData.aadhaarBackUrls)
      urls.push(...this.kycData.aadhaarBackUrls);
    if (this.kycData.panFrontUrls) urls.push(...this.kycData.panFrontUrls);
    if (this.kycData.panBackUrls) urls.push(...this.kycData.panBackUrls);
  }
  if (this.financialInfo) {
    if (this.financialInfo.salarySlips) {
      this.financialInfo.salarySlips.forEach((slip) => {
        if (slip.documentUrls) urls.push(...slip.documentUrls);
      });
    }
    if (this.financialInfo.bankStatement?.documentUrls) {
      urls.push(...this.financialInfo.bankStatement.documentUrls);
    }
    if (this.financialInfo.itrData) {
      this.financialInfo.itrData.forEach((itr) => {
        if (itr.documentUrls) urls.push(...itr.documentUrls);
      });
    }
    if (this.financialInfo.form16Data) {
      this.financialInfo.form16Data.forEach((form) => {
        if (form.documentUrls) urls.push(...form.documentUrls);
      });
    }
  }
  return urls;
};

CoBorrowerSchema.methods.getDocumentSummary = function () {
  const summary = {
    totalDocuments: 0,
    totalImages: 0,
    byType: { kyc: 0, salarySlips: 0, bankStatement: 0, itr: 0, form16: 0 },
  };
  if (this.kycData) {
    summary.byType.kyc =
      (this.kycData.aadhaarFrontUrls?.length || 0) +
      (this.kycData.aadhaarBackUrls?.length || 0) +
      (this.kycData.panFrontUrls?.length || 0) +
      (this.kycData.panBackUrls?.length || 0);
  }
  if (this.financialInfo) {
    if (this.financialInfo.salarySlips) {
      summary.byType.salarySlips = this.financialInfo.salarySlips.reduce(
        (sum, slip) => sum + (slip.documentUrls?.length || 0),
        0
      );
    }
    summary.byType.bankStatement =
      this.financialInfo.bankStatement?.documentUrls?.length || 0;
    if (this.financialInfo.itrData) {
      summary.byType.itr = this.financialInfo.itrData.reduce(
        (sum, itr) => sum + (itr.documentUrls?.length || 0),
        0
      );
    }
    if (this.financialInfo.form16Data) {
      summary.byType.form16 = this.financialInfo.form16Data.reduce(
        (sum, form) => sum + (form.documentUrls?.length || 0),
        0
      );
    }
  }
  summary.totalDocuments = Object.values(summary.byType).reduce(
    (sum, count) => sum + (count > 0 ? 1 : 0),
    0
  );
  summary.totalImages = Object.values(summary.byType).reduce(
    (sum, count) => sum + count,
    0
  );
  return summary;
};

module.exports = mongoose.model("CoBorrower", CoBorrowerSchema);
