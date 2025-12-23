// controllers/students/documentCompleteness.controller.js
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");
const Student = require("../../models/student/students");
const StudentEducationPlan = require("../../models/student/StudentEducationPlan");
const AcademicRecords = require("../../models/student/AcademicRecords");
const TestScores = require("../../models/student/TestScores");
const WorkExperience = require("../../models/student/Workexperience");
const CoBorrower = require("../../models/student/CoBorrower");

/**
 * Calculate document completeness for student dashboard
 * GET /api/loan-analysis/completeness
 * @access Private (Student only)
 */
const getDocumentCompleteness = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  // Fetch student with basic KYC data
  const student = await Student.findById(studentId)
    .select("+kycData.aadhaarFrontUrl +kycData.panCardUrl +kycData.passportUrl")
    .lean();

  if (!student) throw new AppError("Student not found", 404);

  // Fetch related documents in parallel
  const [
    educationPlan,
    academicRecords,
    testScores,
    workExperience,
    coBorrowers,
  ] = await Promise.all([
    StudentEducationPlan.findOne({ student: studentId }).lean(),
    AcademicRecords.findOne({ user: studentId }).lean(),
    TestScores.findOne({ user: studentId }).lean(),
    WorkExperience.findOne({ user: studentId }).lean(),
    CoBorrower.find({ student: studentId, isDeleted: false }).lean(),
  ]);

  // Initialize sections
  const sections = {};
  let totalWeight = 0;
  let earnedWeight = 0;
  let completedFields = 0;
  let totalFields = 0;

  // ========== 1. Education Plan (15%) ==========
  const hasEducationPlan = !!(
    educationPlan &&
    educationPlan.targetCountry &&
    educationPlan.degreeType
  );
  sections.educationPlan = {
    name: "Education Plan",
    completed: hasEducationPlan,
    weight: 15,
    required: true,
  };
  totalWeight += 15;
  totalFields += 1;
  if (hasEducationPlan) {
    earnedWeight += 15;
    completedFields += 1;
  }

  // ========== 2. Student KYC (20%) ==========
  let kycDocs = 0;
  const kycTotalDocs = 3; // Aadhaar, PAN, Passport
  if (student.kycData?.aadhaarFrontUrl) kycDocs++;
  if (student.kycData?.panCardUrl) kycDocs++;
  if (student.kycData?.passportUrl) kycDocs++;

  const kycCompleted = student.kycStatus === "verified";
  sections.kyc = {
    name: "Student KYC",
    completed: kycCompleted,
    documents: kycDocs,
    totalDocuments: kycTotalDocs,
    weight: 20,
    required: true,
  };
  totalWeight += 20;
  totalFields += kycTotalDocs;
  completedFields += kycDocs;
  if (kycCompleted) earnedWeight += 20;

  // ========== 3. Academics (20%) ==========
  let academicDocs = 0;
  let academicTotalDocs = 3; // 10th, 12th, Graduation
  if (academicRecords?.class10?.documentUrl) academicDocs++;
  if (academicRecords?.class12?.documentUrl) academicDocs++;
  if (academicRecords?.graduation?.documentUrl) academicDocs++;

  const academicsCompleted = academicDocs >= 2; // At least 2 documents required
  sections.academics = {
    name: "Academic Records",
    completed: academicsCompleted,
    documents: academicDocs,
    totalDocuments: academicTotalDocs,
    weight: 20,
    required: true,
  };
  totalWeight += 20;
  totalFields += academicTotalDocs;
  completedFields += academicDocs;
  if (academicsCompleted) earnedWeight += 20;

  // ========== 4. Test Scores (Optional - 0%) ==========
  let testDocs = 0;
  let testTotalDocs = 0;
  if (testScores?.toeflScore?.documentUrl) {
    testDocs++;
    testTotalDocs++;
  }
  if (testScores?.greScore?.documentUrl) {
    testDocs++;
    testTotalDocs++;
  }
  if (testScores?.ieltsScore?.documentUrl) {
    testDocs++;
    testTotalDocs++;
  }

  sections.testScores = {
    name: "Test Scores (TOEFL/GRE/IELTS)",
    completed: testDocs > 0,
    documents: testDocs,
    totalDocuments: testTotalDocs || 0,
    weight: 0,
    required: false,
  };
  // Optional - don't add to weight calculation
  totalFields += testTotalDocs;
  completedFields += testDocs;

  // ========== 5. Work Experience (Optional - 0%) ==========
  const workExpCount = workExperience?.workExperiences?.length || 0;
  const validWorkExpCount = workExperience?.validExperiences || 0;

  sections.workExperience = {
    name: "Work Experience",
    completed: validWorkExpCount > 0,
    documents: validWorkExpCount,
    totalDocuments: workExpCount,
    weight: 0,
    required: false,
  };
  // Optional - don't add to weight calculation
  totalFields += workExpCount;
  completedFields += validWorkExpCount;

  // ========== 6. Co-borrower KYC (20%) ==========
  const verifiedCoBorrowers = coBorrowers.filter(
    (cb) => cb.kycStatus === "verified"
  );
  const hasCoBorrowerKyc = verifiedCoBorrowers.length > 0;

  sections.coBorrowerKyc = {
    name: "Co-borrower KYC",
    completed: hasCoBorrowerKyc,
    count: verifiedCoBorrowers.length,
    totalCount: coBorrowers.length,
    weight: 20,
    required: true,
  };
  totalWeight += 20;
  totalFields += 1;
  if (hasCoBorrowerKyc) {
    earnedWeight += 20;
    completedFields += 1;
  }

  // ========== 7. Co-borrower Financial Docs (25%) ==========
  const coBorrowersWithFinancials = coBorrowers.filter(
    (cb) =>
      cb.financialVerificationStatus === "verified" ||
      cb.financialVerificationStatus === "partial"
  );
  const hasCoBorrowerFinancial = coBorrowersWithFinancials.length > 0;

  sections.coBorrowerFinancial = {
    name: "Co-borrower Financial Documents",
    completed: hasCoBorrowerFinancial,
    count: coBorrowersWithFinancials.length,
    totalCount: coBorrowers.length,
    weight: 25,
    required: true,
  };
  totalWeight += 25;
  totalFields += 1;
  if (hasCoBorrowerFinancial) {
    earnedWeight += 25;
    completedFields += 1;
  }

  // ========== Calculate Overall Percentage ==========
  const percentage =
    totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  // Determine next action
  let nextAction = "All documents complete!";
  if (!hasEducationPlan) {
    nextAction = "Complete your education plan";
  } else if (!kycCompleted) {
    nextAction = "Complete KYC verification";
  } else if (!academicsCompleted) {
    nextAction = "Upload academic documents";
  } else if (!hasCoBorrowerKyc) {
    nextAction = "Add and verify co-borrower KYC";
  } else if (!hasCoBorrowerFinancial) {
    nextAction = "Upload co-borrower financial documents";
  }

  // Check if ready for loan analysis
  const readyForAnalysis =
    hasEducationPlan &&
    kycCompleted &&
    academicsCompleted &&
    hasCoBorrowerKyc &&
    hasCoBorrowerFinancial;

  return res.status(200).json({
    success: true,
    data: {
      percentage,
      completedFields,
      totalFields,
      sections,
      nextAction,
      readyForAnalysis,
    },
  });
});

module.exports = {
  getDocumentCompleteness,
};
