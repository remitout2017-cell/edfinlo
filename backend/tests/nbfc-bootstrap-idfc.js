/**
 * seed-idfc-nbfc.js
 *
 * Run:
 *   node .\seed-idfc-nbfc.js
 *
 * Requires .env with:
 *   MONGO_URI=...
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Adjust path if your structure differs
const NBFC = require("./NBFC"); // if NBFC.js is in same folder as this script
// If your actual path is models/nbfc/NBFC.js then use:
// const NBFC = require("./models/nbfc/NBFC");

function removeUndefinedDeep(obj) {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === undefined) {
      delete obj[key];
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      removeUndefinedDeep(val);
    }
  }
  return obj;
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("Missing MONGO_URI in .env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  // -------- NBFC identity --------
  const companyName = "IDFC FIRST Bank";
  const email = "idfc.seed@nbfc.test";
  const password = "SecurePass123!"; // only used on first creation

  // Find existing NBFC (email or companyName are unique in schema)
  let nbfc =
    (await NBFC.findOne({ email: email.toLowerCase() })) ||
    (await NBFC.findOne({ companyName }));

  if (!nbfc) {
    nbfc = new NBFC({
      companyName,
      email: email.toLowerCase(),
      password, // will be hashed by pre-save in schema
      phoneNumber: "+919999999999",
      contactPerson: {
        name: "Seed Bot",
        designation: "System",
        email: email.toLowerCase(),
        phone: "+919999999999",
      },
      questionnaireCompleted: true,
    });
  } else {
    // Update identity (don’t overwrite password for safety)
    nbfc.companyName = companyName;
    nbfc.email = email.toLowerCase();
    nbfc.questionnaireCompleted = true;
    if (!nbfc.phoneNumber) nbfc.phoneNumber = "+919999999999";
  }

  // -------- Seed: IDFC policy -> loanConfig mapping --------
  const existingLoanConfig = nbfc.loanConfig || {};

  const seededLoanConfig = {
    ...existingLoanConfig,

    enabled: true,

    cibil: {
      ...(existingLoanConfig.cibil || {}),
      minScore: 700,
      allowOverdue: false,
      checkBounceInOwnBank: true, // image says "no IDFC bounces"
    },

    foir: {
      ...(existingLoanConfig.foir || {}),
      maxPercentage: 50,
      borderlineStart: 45,
      actionWhenBorderline: "Clarification",
    },

    incomeItr: {
      ...(existingLoanConfig.incomeItr || {}),
      itrRequired: false, // image: "no min ITR stated"
      minMonthlySalary: 25000, // image: "₹25k salary"
      // minAnnualIncome not stated in image; leave existing/default
    },

    bankBalance: {
      ...(existingLoanConfig.bankBalance || {}),
      required: true,
      minAvgBalance: 5000, // image: "₹5k min"
      statementMonthsRequired: 3, // image: "3m slips" (closest match)
    },

    academics: {
      ...(existingLoanConfig.academics || {}),
      minPercentage10th: 60,
      minPercentage12th: 60,
      minPercentageGrad: 60,
      maxGapYears: 2,
      gapYearsAction: "Clarification", // image: "≤2yr gap w/ reason"
    },

    university: {
      ...(existingLoanConfig.university || {}),
      categorySystem: true, // image: "gold/bronze cat"
      rankingRequired: false,
      unrankedAction: "Clarification",
    },

    loanToIncome: {
      ...(existingLoanConfig.loanToIncome || {}),
      // image: unsecured <= 1Cr; min 38L
      unsecuredMinAmount: 3800000,
      unsecuredMaxAmount: 10000000,
      // maxMultiple not stated; keep existing/default
    },

    // IMPORTANT: must always be an object to avoid CastError
    collateral: {
      ...(existingLoanConfig.collateral || {}),
      // not in image; keep default minCoverageMultiple from schema
      // requiredAboveAmount not specified
    },

    offerLetter: {
      ...(existingLoanConfig.offerLetter || {}),
      required: false,
      canSanctionWithout: true, // image: offer letter needed for additional loan post-sanction
    },

    tests: {
      ...(existingLoanConfig.tests || {}),
      greMinScore: 300,
      ieltsMinScore: 6.5,
      // toeflMinScore not mentioned
    },

    coBorrower: {
      ...(existingLoanConfig.coBorrower || {}),
      mandatory: true,
      relationByUniversityTier: true, // image: tier-based relations
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
    },

    roi: {
      ...(existingLoanConfig.roi || {}),
      // image: "USA 11-14%; others ≥11.5%"
      minRate: 11.0,
      maxRate: 14.0,
      currency: "INR",
    },

    negativeCourses: [
      "International MBBS",
      "Hybrid/partial domestic programs",
    ],
  };

  // Clean undefined values (extra safety for Mongoose nested objects)
  nbfc.loanConfig = removeUndefinedDeep(seededLoanConfig);

  // Extra hard-guard for the exact error you hit:
  if (!nbfc.loanConfig.collateral || typeof nbfc.loanConfig.collateral !== "object") {
    nbfc.loanConfig.collateral = {};
  }

  await nbfc.save();

  console.log("✅ Seeded/Updated NBFC successfully:");
  console.log({
    id: nbfc._id.toString(),
    companyName: nbfc.companyName,
    email: nbfc.email,
    questionnaireCompleted: nbfc.questionnaireCompleted,
  });

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
