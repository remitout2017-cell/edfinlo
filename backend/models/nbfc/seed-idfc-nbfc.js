/**
 * Location: backend/models/nbfc/seed-idfc-nbfc.js
 *
 * Run (recommended from backend root):
 *   node .\models\nbfc\seed-idfc-nbfc.js
 *
 * Or (if you run inside backend\models\nbfc):
 *   node .\seed-idfc-nbfc.js
 */

const path = require("path");
require("dotenv").config({
  // your .env is in backend/.env (two levels up from models/nbfc)
  path: path.resolve(__dirname, "../../.env"),
});

const mongoose = require("mongoose");
const NBFC = require("./NBFC"); // same folder: backend/models/nbfc/NBFC.js

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

async function main() {
  const uri = "mongodb://localhost:27017/laon3";

  if (!uri) {
    throw new Error(
      "Missing Mongo connection env. Set one of: MONGO_URI / MONGODB_URI / MONGO_URL / DATABASE_URL"
    );
  }

  await mongoose.connect(uri);

  const companyName = "IDFC FIRST Bank";
  const email = "idfc.seed@nbfc.test";
  const password = "SecurePass123!"; // used only if creating new NBFC

  let nbfc =
    (await NBFC.findOne({ email: email.toLowerCase() })) ||
    (await NBFC.findOne({ companyName }));

  if (!nbfc) {
    nbfc = new NBFC({
      companyName,
      email: email.toLowerCase(),
      password,
      phoneNumber: "+919999999999",
      contactPerson: {
        name: "Seed Bot",
        designation: "System",
        email: email.toLowerCase(),
        phone: "+919999999999",
      },
      questionnaireCompleted: true, // your controllers use this field
    });
  } else {
    nbfc.companyName = companyName;
    nbfc.email = email.toLowerCase();
    nbfc.questionnaireCompleted = true;
    if (!nbfc.phoneNumber) nbfc.phoneNumber = "+919999999999";
  }

  // ---------- IMPORTANT: never assign whole loanConfig object ----------
  // Instead, initialize and set nested paths safely (prevents collateral cast error). [file:2]
  if (!nbfc.loanConfig) nbfc.loanConfig = {};

  // Force sub-objects to exist
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

  // ✅ THIS LINE FIXES YOUR ERROR: collateral must be an object, never undefined. [file:2]
  if (
    !nbfc.loanConfig.collateral ||
    typeof nbfc.loanConfig.collateral !== "object"
  ) {
    nbfc.loanConfig.collateral = {};
  }

  // Now set the IDFC policy (based on your screenshot)
  nbfc.loanConfig.enabled = true;

  nbfc.loanConfig.cibil.minScore = 700;
  nbfc.loanConfig.cibil.allowOverdue = false;
  nbfc.loanConfig.cibil.checkBounceInOwnBank = true;

  nbfc.loanConfig.foir.maxPercentage = 50;
  nbfc.loanConfig.foir.borderlineStart = 45;
  nbfc.loanConfig.foir.actionWhenBorderline = "Clarification";

  nbfc.loanConfig.incomeItr.itrRequired = false; // "no min ITR stated"
  nbfc.loanConfig.incomeItr.minMonthlySalary = 25000;

  nbfc.loanConfig.bankBalance.required = true;
  nbfc.loanConfig.bankBalance.minAvgBalance = 5000;
  nbfc.loanConfig.bankBalance.statementMonthsRequired = 3;

  nbfc.loanConfig.academics.minPercentage10th = 60;
  nbfc.loanConfig.academics.minPercentage12th = 60;
  nbfc.loanConfig.academics.minPercentageGrad = 60;
  nbfc.loanConfig.academics.maxGapYears = 2;
  nbfc.loanConfig.academics.gapYearsAction = "Clarification";

  nbfc.loanConfig.university.categorySystem = true;
  nbfc.loanConfig.university.rankingRequired = false;
  nbfc.loanConfig.university.unrankedAction = "Clarification";

  nbfc.loanConfig.loanToIncome.unsecuredMinAmount = 3800000; // 38L
  nbfc.loanConfig.loanToIncome.unsecuredMaxAmount = 10000000; // 1Cr

  // keep collateral defaults (schema has minCoverageMultiple default 1.2)
  // but set explicitly to avoid weird states
  if (nbfc.loanConfig.collateral.minCoverageMultiple == null) {
    nbfc.loanConfig.collateral.minCoverageMultiple = 1.2;
  }

  nbfc.loanConfig.offerLetter.required = false;
  nbfc.loanConfig.offerLetter.canSanctionWithout = true;

  nbfc.loanConfig.tests.greMinScore = 300;
  nbfc.loanConfig.tests.ieltsMinScore = 6.5;

  nbfc.loanConfig.coBorrower.mandatory = true;
  nbfc.loanConfig.coBorrower.relationByUniversityTier = true;
  nbfc.loanConfig.coBorrower.allowedRelations = [
    "father",
    "mother",
    "brother",
    "sister",
    "spouse",
    "uncle",
    "aunt",
    "guardian",
  ];

  nbfc.loanConfig.roi.minRate = 11.0;
  nbfc.loanConfig.roi.maxRate = 14.0;
  nbfc.loanConfig.roi.currency = "INR";

  nbfc.loanConfig.negativeCourses = [
    "International MBBS",
    "Hybrid/partial domestic programs",
  ];

  // Remove undefined keys (extra safety)
  removeUndefinedDeep(nbfc.loanConfig);

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
