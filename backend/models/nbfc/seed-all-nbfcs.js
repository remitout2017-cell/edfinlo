/**
 * Location: backend/models/nbfc/seed-all-nbfcs.js
 *
 * Seeds 3 NBFCs: IDFC FIRST Bank, Auxilo Finserve, Credila Financial Services
 *
 * Run from backend root:
 * node ./models/nbfc/seed-all-nbfcs.js
 */

const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});
const mongoose = require("mongoose");
const NBFC = require("./NBFC");

// Utility to remove undefined values deep
function removeUndefinedDeep(obj) {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === undefined) delete obj[key];
    else if (val && typeof val === "object" && !Array.isArray(val))
      removeUndefinedDeep(val);
  }
  return obj;
}

// Safe initialization of nested loanConfig
function initializeLoanConfig(nbfc) {
  if (!nbfc.loanConfig) nbfc.loanConfig = {};

  // Initialize all nested objects
  if (!nbfc.loanConfig.cibil) nbfc.loanConfig.cibil = {};
  if (!nbfc.loanConfig.foir) nbfc.loanConfig.foir = {};
  if (!nbfc.loanConfig.incomeItr) nbfc.loanConfig.incomeItr = {};
  if (!nbfc.loanConfig.bankBalance) nbfc.loanConfig.bankBalance = {};
  if (!nbfc.loanConfig.academics) nbfc.loanConfig.academics = {};
  if (!nbfc.loanConfig.university) nbfc.loanConfig.university = {};
  if (!nbfc.loanConfig.loanToIncome) nbfc.loanConfig.loanToIncome = {};
  if (!nbfc.loanConfig.offerLetter) nbfc.loanConfig.offerLetter = {};
  if (!nbfc.loanConfig.tests) nbfc.loanConfig.tests = {};
  if (!nbfc.loanConfig.coBorrower) nbfc.loanConfig.coBorrower = {};
  if (!nbfc.loanConfig.roi) nbfc.loanConfig.roi = {};

  // ✅ Critical: collateral must be an object, never undefined
  if (
    !nbfc.loanConfig.collateral ||
    typeof nbfc.loanConfig.collateral !== "object"
  ) {
    nbfc.loanConfig.collateral = {};
  }
}

// NBFC configurations
const nbfcConfigs = [
  {
    companyName: "IDFC FIRST Bank",
    brandName: "IDFC FIRST",
    email: "idfc.first@example.com",
    password: "SecurePass123!",
    phoneNumber: "9876543210",
    registrationNumber: "IDFC-REG-001",
    gstNumber: "27ABCDE1234F1Z5",
    address: {
      line1: "IDFC FIRST Bank Ltd",
      line2: "Corporate Office",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
    },
    contactPerson: {
      name: "IDFC Credit Manager",
      designation: "Credit Manager",
      email: "credit.manager@idfcfirst.com",
      phone: "9876543210",
    },
    loanConfig: {
      enabled: true,
      cibil: {
        minScore: 650,
        allowOverdue: false,
        checkBounceInOwnBank: false,
      },
      foir: {
        maxPercentage: 75,
        borderlineStart: 60,
        actionWhenBorderline: "Clarification",
      },
      incomeItr: {
        itrRequired: true,
        minAnnualIncome: 500000,
        itrYearsRequired: 2,
      },
      bankBalance: {
        required: false,
        minAvgBalance: 10000,
        statementMonthsRequired: 6,
      },
      academics: {
        minPercentage10th: 55,
        minPercentage12th: 55,
        minPercentageGrad: 55,
        maxGapYears: 2,
        gapYearsAction: "Clarification",
      },
      university: {
        rankingRequired: false,
        unrankedAction: "Rejected",
        categorySystem: false,
      },
      loanToIncome: { maxMultiple: 8 },
      collateral: { minCoverageMultiple: 1.2 },
      offerLetter: { required: true, canSanctionWithout: false },
      tests: { othersOptional: true },
      coBorrower: {
        mandatory: true,
        allowedRelations: [
          "father",
          "mother",
          "brother",
          "sister",
          "spouse",
          "uncle",
          "aunt",
          "guardian",
        ],
        relationByUniversityTier: false,
      },
      roi: { minRate: 9, maxRate: 14, currency: "INR" },
      negativeCourses: [],
    },
  },
  {
    companyName: "Auxilo Finserve Pvt Ltd",
    brandName: "Auxilo",
    email: "auxilo@example.com",
    password: "SecurePass123!",
    phoneNumber: "9876501234",
    registrationNumber: "AUXILO-REG-001",
    gstNumber: "27ABCDE1234F1Z5",
    address: {
      line1: "Auxilo Finserve Pvt Ltd",
      line2: "Corporate Office",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
    },
    contactPerson: {
      name: "Auxilo Credit Manager",
      designation: "Credit Manager",
      email: "credit.manager@auxilo.com",
      phone: "9876501234",
    },
    loanConfig: {
      enabled: true,
      cibil: {
        minScore: 650,
        allowOverdue: false,
        checkBounceInOwnBank: false,
      },
      foir: {
        maxPercentage: 75,
        borderlineStart: 60,
        actionWhenBorderline: "Clarification",
      },
      incomeItr: {
        itrRequired: true,
        minAnnualIncome: 500000,
        minMonthlySalary: 0,
        itrYearsRequired: 2,
      },
      bankBalance: {
        required: false,
        minAvgBalance: 0,
        statementMonthsRequired: 6,
      },
      academics: {
        minPercentage10th: 55,
        minPercentage12th: 55,
        minPercentageGrad: 55,
        maxGapYears: 2,
        gapYearsAction: "Clarification",
      },
      university: {
        rankingRequired: false,
        unrankedAction: "Rejected",
        categorySystem: false,
      },
      loanToIncome: {
        maxMultiple: 8,
        unsecuredMinAmount: 0,
        unsecuredMaxAmount: 0,
      },
      collateral: { requiredAboveAmount: 0, minCoverageMultiple: 1.2 },
      offerLetter: { required: false, canSanctionWithout: true },
      tests: {
        greMinScore: 0,
        ieltsMinScore: 0,
        toeflMinScore: 0,
        othersOptional: true,
      },
      coBorrower: {
        mandatory: true,
        allowedRelations: [
          "father",
          "mother",
          "brother",
          "sister",
          "spouse",
          "uncle",
          "aunt",
          "guardian",
        ],
        relationByUniversityTier: false,
      },
      roi: { minRate: 9, maxRate: 14, currency: "INR" },
      negativeCourses: [],
    },
  },
  {
    companyName: "Credila Financial Services Pvt Ltd",
    brandName: "Credila",
    email: "credila@example.com",
    password: "SecurePass123!",
    phoneNumber: "9876512345",
    registrationNumber: "CREDILA-REG-001",
    gstNumber: "27ABCDE1234F1Z5",
    address: {
      line1: "Credila Financial Services Pvt Ltd",
      line2: "Corporate Office",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
    },
    contactPerson: {
      name: "Credila Credit Manager",
      designation: "Credit Manager",
      email: "credit.manager@credila.com",
      phone: "9876512345",
    },
    loanConfig: {
      enabled: true,
      cibil: {
        minScore: 650,
        allowOverdue: false,
        checkBounceInOwnBank: false,
      },
      foir: {
        maxPercentage: 75,
        borderlineStart: 60,
        actionWhenBorderline: "Clarification",
      },
      incomeItr: {
        itrRequired: true,
        minAnnualIncome: 500000,
        itrYearsRequired: 2,
      },
      bankBalance: {
        required: false,
        minAvgBalance: 10000,
        statementMonthsRequired: 6,
      },
      academics: {
        minPercentage10th: 55,
        minPercentage12th: 55,
        minPercentageGrad: 55,
        maxGapYears: 2,
        gapYearsAction: "Clarification",
      },
      university: {
        rankingRequired: false,
        unrankedAction: "Rejected",
        categorySystem: false,
      },
      loanToIncome: { maxMultiple: 8 },
      collateral: { minCoverageMultiple: 1.2 },
      offerLetter: { required: true, canSanctionWithout: false },
      tests: { othersOptional: true },
      coBorrower: {
        mandatory: true,
        allowedRelations: [
          "father",
          "mother",
          "brother",
          "sister",
          "spouse",
          "uncle",
          "aunt",
          "guardian",
        ],
        relationByUniversityTier: false,
      },
      roi: { minRate: 9, maxRate: 14, currency: "INR" },
      negativeCourses: [],
    },
  },
];

async function seedNBFC(config) {
  const { email, companyName } = config;

  // Check if NBFC exists
  let nbfc =
    (await NBFC.findOne({ email: email.toLowerCase() })) ||
    (await NBFC.findOne({ companyName }));

  if (!nbfc) {
    // Create new NBFC
    nbfc = new NBFC({
      ...config,
      email: email.toLowerCase(),
      isEmailVerified: true,
      isPhoneVerified: true,
      isActive: true,
      isApprovedByAdmin: true,
      questionnaireCompleted: true,
    });
  } else {
    // Update existing NBFC
    Object.assign(nbfc, {
      companyName: config.companyName,
      brandName: config.brandName,
      email: email.toLowerCase(),
      phoneNumber: config.phoneNumber,
      registrationNumber: config.registrationNumber,
      gstNumber: config.gstNumber,
      address: config.address,
      contactPerson: config.contactPerson,
      isEmailVerified: true,
      isPhoneVerified: true,
      isActive: true,
      isApprovedByAdmin: true,
      questionnaireCompleted: true,
    });
  }

  // Safe loanConfig initialization
  initializeLoanConfig(nbfc);

  // Apply loan config from seed data
  Object.assign(nbfc.loanConfig, config.loanConfig);

  // Remove undefined values
  removeUndefinedDeep(nbfc.loanConfig);

  await nbfc.save();

  return nbfc;
}

async function main() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL ||
    "mongodb://localhost:27017/laon3";

  if (!uri) {
    throw new Error("Missing MongoDB connection string in environment");
  }

  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("✅ Connected to MongoDB\n");

  console.log("🌱 Seeding NBFCs...\n");

  const results = [];
  for (const config of nbfcConfigs) {
    try {
      const nbfc = await seedNBFC(config);
      results.push({
        success: true,
        companyName: nbfc.companyName,
        email: nbfc.email,
        id: nbfc._id.toString(),
      });
      console.log(`✅ ${nbfc.companyName} - ${nbfc.email}`);
    } catch (error) {
      results.push({
        success: false,
        companyName: config.companyName,
        email: config.email,
        error: error.message,
      });
      console.error(`❌ Failed to seed ${config.companyName}:`, error.message);
    }
  }

  console.log("\n📊 Seeding Summary:");
  console.log(`   Total: ${results.length}`);
  console.log(`   Success: ${results.filter((r) => r.success).length}`);
  console.log(`   Failed: ${results.filter((r) => !r.success).length}`);

  await mongoose.disconnect();
  console.log("\n👋 Disconnected from MongoDB");
}

main().catch((error) => {
  console.error("❌ Seed script failed:", error);
  process.exit(1);
});
