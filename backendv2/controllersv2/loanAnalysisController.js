// controllersv2/loanAnalysisControllerV2.js

const Student = require("../models/students");
const CoBorrower = require("../models/CoBorrower");
const AcademicRecords = require("../models/AcademicRecords");
const Workexperience = require("../models/Workexperience");
const AdmissionLetter = require("../models/AdmissionLetter");
const LoanAnalysisHistory = require("../models/LoanAnalysisHistory");

const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");
const {
  LoanAnalysisWorkflow,
} = require("../ai/workflows/LoanAnalysisWorkflow");

// NEW: Professional matcher (from previous message)
const nbfcMatcher = require("../services/NBFCMatcher");

// ----------------------------------------------
// Helpers
// ----------------------------------------------
function checkBasicRequirements({
  student,
  academicRecords,
  admissionLetter,
  coBorrowers,
}) {
  const missing = [];

  // KYC: trust kycStatus; numbers are select:false and not always present
  if (student.kycStatus !== "verified") missing.push("KYC verification");

  if (!academicRecords) missing.push("Academic Records");
  if (!admissionLetter) missing.push("Admission Letter");
  if (!coBorrowers || coBorrowers.length === 0)
    missing.push("At least one Co-Borrower");

  return {
    eligible: missing.length === 0,
    missing,
  };
}

function buildStudentSnapshot({
  student,
  academicRecords,
  admissionLetter,
  workExperience,
  coBorrowers,
}) {
  return {
    hasKYC: student.kycStatus === "verified",
    hasAcademicRecords: !!academicRecords,
    hasAdmissionLetter: !!admissionLetter,
    hasWorkExperience: !!workExperience,
    coBorrowerCount: coBorrowers?.length || 0,
    kycStatus: student.kycStatus,
  };
}

function generateNextSteps(analysisResult, nbfcPack) {
  const steps = [];
  const eligibleCount = nbfcPack?.summary?.eligibleCount || 0;

  if (analysisResult?.eligibility?.eligible) {
    steps.push({
      step: 1,
      action: "Review NBFC Options",
      description: `Compare ${eligibleCount} eligible lenders and choose the best ROI + policy fit.`,
      priority: "high",
    });
    steps.push({
      step: 2,
      action: "Submit Loan Request",
      description:
        "Proceed with your selected NBFC and submit the loan request.",
      priority: "high",
    });
    steps.push({
      step: 3,
      action: "Prepare Additional Documents",
      description:
        "Keep ITR/Form16 and bank statements ready for verification checks.",
      priority: "medium",
    });
  } else {
    steps.push({
      step: 1,
      action: "Fix Eligibility Gaps",
      description:
        analysisResult?.recommendations?.improvements?.[0] ||
        "Upload missing documents and improve eligibility.",
      priority: "high",
    });
    steps.push({
      step: 2,
      action: "Re-run Analysis",
      description: "Re-run loan analysis after completing improvements.",
      priority: "medium",
    });
  }

  return steps;
}

// ----------------------------------------------
// 🎯 Run loan analysis
// ----------------------------------------------
exports.runLoanAnalysisV2 = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const studentId = req.user._id;

  const {
    requestedAmount,
    requestedTenure,
    purpose,
    urgency = "normal",
  } = req.body;

  if (!requestedAmount || requestedAmount < 10000) {
    throw new AppError("Requested loan amount must be at least ₹10,000", 400);
  }
  if (!requestedTenure || requestedTenure < 6 || requestedTenure > 180) {
    throw new AppError(
      "Requested tenure must be between 6 and 180 months",
      400
    );
  }

  // Fetch core student + docs in parallel
  const studentPromise = Student.findById(studentId)
    // These are select:false in schema, so we explicitly include them
    .select("+kycData.aadhaarNumber +kycData.panNumber")
    .populate("academicRecords")
    .populate("workExperience")
    .lean();

  const admissionPromise = AdmissionLetter.findOne({ student: studentId })
    .sort({ createdAt: -1 })
    .lean();
  const academicPromise = AcademicRecords.findOne({
    student: studentId,
  }).lean();
  const workPromise = Workexperience.findOne({ user: studentId }).lean();
  const coBorrowersPromise = CoBorrower.find({ student: studentId }).lean();

  const [
    student,
    admissionLetter,
    academicFallback,
    workFallback,
    coBorrowers,
  ] = await Promise.all([
    studentPromise,
    admissionPromise,
    academicPromise,
    workPromise,
    coBorrowersPromise,
  ]);

  if (!student) throw new AppError("Student not found", 404);

  // Prefer populated versions, fallback to direct query if not populated
  const academicRecords = student.academicRecords || academicFallback || null;
  const workExperience = student.workExperience || workFallback || null;

  const requirements = checkBasicRequirements({
    student,
    academicRecords,
    admissionLetter,
    coBorrowers,
  });

  if (!requirements.eligible) {
    return res.status(400).json({
      success: false,
      message: "Missing required prerequisites for analysis",
      missingDocuments: requirements.missing,
    });
  }

  // Build workflow input (clean & schema-safe)
  const analysisInput = {
    student: {
      id: student._id,
      name: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
      email: student.email,
      phoneNumber: student.phoneNumber,
      dateOfBirth: student.dateOfBirth,
      kyc: {
        verified: student.kycStatus === "verified",
        aadhaarVerified: !!student.kycData?.aadhaarNumber,
        panVerified: !!student.kycData?.panNumber,
      },
      academic: academicRecords
        ? {
            institutionName: academicRecords.institutionName,
            degree: academicRecords.degree,
            currentYear: academicRecords.currentYear,
            cgpa: academicRecords.cgpa,
            percentage: academicRecords.percentage,
            verified: academicRecords.verificationStatus === "verified",
          }
        : null,
      workExperience: workExperience
        ? {
            companyName: workExperience.companyName,
            jobTitle: workExperience.jobTitle,
            monthsWorked: workExperience.monthsWorked,
            isPaid: workExperience.isPaid,
            stipendAmount: workExperience.stipendAmount,
            verified: !!workExperience.verified,
          }
        : null,
      admission: admissionLetter
        ? {
            university: admissionLetter.universityName,
            country: admissionLetter.country,
            courseName: admissionLetter.courseName,
            courseLevel: admissionLetter.courseLevel,
            tuitionFee: admissionLetter.tuitionFee,
            verified: admissionLetter.verificationStatus === "verified",
          }
        : null,
    },

    coBorrowers: (coBorrowers || []).map((cb) => ({
      id: cb._id,
      name: `${cb.firstName || ""} ${cb.lastName || ""}`.trim(),
      relationToStudent: cb.relationToStudent,
      kyc: { verified: cb.kycStatus === "verified" },
      financial: {
        avgMonthlySalary:
          cb.financialInfo?.financialSummary?.avgMonthlySalary || 0,
        estimatedAnnualIncome:
          cb.financialInfo?.financialSummary?.estimatedAnnualIncome || 0,
        totalExistingEmi:
          cb.financialInfo?.financialSummary?.totalExistingEmi || 0,
        foir: cb.financialInfo?.financialSummary?.foir || 0,
        incomeSource:
          cb.financialInfo?.financialSummary?.incomeSource || "other",
        salarySlipCount: cb.financialInfo?.salarySlips?.length || 0,
        itrYearsCovered: cb.financialInfo?.itrData?.length || 0,
        bankStatementVerified:
          cb.financialInfo?.bankStatement?.status === "verified",
        completenessScore:
          cb.financialInfo?.financialSummary?.documentCompleteness
            ?.completenessScore || 0,
      },
    })),

    loanRequest: {
      requestedAmount,
      requestedTenure,
      purpose: purpose || "Education",
      urgency,
    },
  };

  // Run workflow (AI + deterministic computations inside)
  const workflow = new LoanAnalysisWorkflow();
  const analysisResult = await workflow.analyze(analysisInput);

  // NBFC matching (rules-based from NBFC.loanConfig.*)
  const nbfcPack = await nbfcMatcher.matchStudentWithNBFCs(
    analysisInput.student,
    coBorrowers,
    requestedAmount,
    requestedTenure
  );

  const flattenedNBFCs = [
    ...(nbfcPack.eligible || []),
    ...(nbfcPack.borderline || []),
    ...(nbfcPack.notEligible || []),
  ];

  // Persist using Option B schema
  const analysisDoc = await LoanAnalysisHistory.create({
    student: studentId,
    requestedAmount,
    requestedTenure,
    purpose: purpose || "Education",
    urgency,

    eligibility: analysisResult.eligibility,
    riskAssessment: analysisResult.risk,
    financialSummary: analysisResult.financial,

    matchedNBFCs: flattenedNBFCs,
    nbfcSummary: nbfcPack.summary,

    recommendations: {
      ...analysisResult.recommendations,
      nextSteps: generateNextSteps(analysisResult, nbfcPack),
    },

    analysisMetadata: {
      analysisDate: new Date(),
      processingTimeMs: Date.now() - startTime,
      aiModel: analysisResult?.meta?.aiModel || "gemini",
      workflowVersion: "2.0",
      cached: false,
    },

    status: analysisResult?.eligibility?.eligible ? "eligible" : "not_eligible",
    studentSnapshot: buildStudentSnapshot({
      student,
      academicRecords,
      admissionLetter,
      workExperience,
      coBorrowers,
    }),
  });

  return res.status(200).json({
    success: true,
    message: "Loan analysis completed successfully",
    analysisId: analysisDoc._id,
    processingTimeMs: analysisDoc.analysisMetadata.processingTimeMs,
    eligibility: analysisDoc.eligibility,
    riskAssessment: analysisDoc.riskAssessment,
    financial: analysisDoc.financialSummary,
    nbfcSummary: analysisDoc.nbfcSummary,
    topNBFCs: (nbfcPack.eligible || []).slice(0, 3),
    recommendations: analysisDoc.recommendations,
  });
});

// ----------------------------------------------
// 📋 History
// ----------------------------------------------
exports.getAnalysisHistoryV2 = asyncHandler(async (req, res) => {
  const data = await LoanAnalysisHistory.find({ student: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .select(
      "createdAt requestedAmount requestedTenure purpose status eligibility nbfcSummary riskAssessment analysisMetadata"
    )
    .lean();

  res.status(200).json({ success: true, count: data.length, data });
});

// ----------------------------------------------
// 📊 Details
// ----------------------------------------------
exports.getAnalysisDetailsV2 = asyncHandler(async (req, res) => {
  const { analysisId } = req.params;

  const analysis = await LoanAnalysisHistory.findOne({
    _id: analysisId,
    student: req.user._id,
  })
    .populate(
      "matchedNBFCs.nbfc",
      "companyName brandName loanConfig.roi loanConfig.foir"
    )
    .lean();

  if (!analysis) throw new AppError("Analysis not found", 404);

  res.status(200).json({ success: true, data: analysis });
});
