// ============================================================================
// chatbot/utils/userDataFetcher.js
// Fetches REAL user data to make chatbot context-aware
// ============================================================================

const Student = require("../../models/student/students");
const AcademicRecords = require("../../models/student/AcademicRecords");
const TestScores = require("../../models/student/TestScores");
const WorkExperience = require("../../models/student/Workexperience");
const AdmissionLetter = require("../../models/student/AdmissionLetter");
const CoBorrower = require("../../models/student/CoBorrower");
const StudentEducationPlan = require("../../models/student/StudentEducationPlan");
const LoanRequest = require("../../models/student/LoanRequest");

/**
 * Fetch complete user context for chatbot
 * @param {String} userId - Student ID
 * @returns {Object} Complete user context
 */
async function getUserContext(userId) {
  try {
    // Fetch all data in parallel
    const [
      student,
      educationPlan,
      academics,
      testScores,
      workExp,
      admissions,
      coBorrowers,
      loanRequests,
    ] = await Promise.all([
      Student.findById(userId)
        .select("firstName lastName email phoneNumber kycStatus kycVerifiedAt")
        .lean(),
      StudentEducationPlan.findOne({ student: userId }).lean(),
      AcademicRecords.findOne({ user: userId }).lean(),
      TestScores.findOne({ user: userId }).lean(),
      WorkExperience.findOne({ user: userId }).lean(),
      AdmissionLetter.find({ user: userId }).lean(),
      CoBorrower.find({
        student: userId,
        isDeleted: false,
      }).lean(),
      LoanRequest.find({ student: userId })
        .populate("nbfc", "companyName")
        .lean(),
    ]);

    if (!student) return null;

    // Calculate completion status
    const completionStatus = calculateCompletion({
      student,
      educationPlan,
      academics,
      testScores,
      workExp,
      admissions,
      coBorrowers,
    });

    return {
      // Basic info
      name: student.firstName,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      phone: student.phoneNumber,

      // KYC Status
      kycStatus: student.kycStatus,
      kycVerified: student.kycStatus === "verified",
      kycVerifiedDate: student.kycVerifiedAt,

      // Education Plan
      hasEducationPlan: !!educationPlan,
      educationPlan: educationPlan
        ? {
            country: educationPlan.targetCountry,
            degreeType: educationPlan.degreeType,
            courseDetails: educationPlan.courseDetails,
            loanAmount: educationPlan.loanAmountRequested,
          }
        : null,

      // Academic Documents
      academics: {
        hasClass10: !!academics?.class10?.documentUrl,
        hasClass12: !!academics?.class12?.documentUrl,
        hasGraduation: !!academics?.graduation?.documentUrl,
        class10Percentage: academics?.class10?.percentage,
        class12Percentage: academics?.class12?.percentage,
        graduationCGPA: academics?.graduation?.finalCgpa,
      },

      // Test Scores
      testScores: {
        hasTOEFL: !!testScores?.toeflScore?.documentUrl,
        hasGRE: !!testScores?.greScore?.documentUrl,
        hasIELTS: !!testScores?.ieltsScore?.documentUrl,
        toeflScore: testScores?.toeflScore?.totalScore,
        greScore:
          testScores?.greScore?.verbalReasoning &&
          testScores?.greScore?.quantitativeReasoning
            ? testScores.greScore.verbalReasoning +
              testScores.greScore.quantitativeReasoning
            : null,
        ieltsScore: testScores?.ieltsScore?.overallBandScore,
      },

      // Work Experience
      workExperience: {
        hasWorkExp: !!workExp && workExp.validExperiences > 0,
        totalYears: workExp?.totalYearsExperience || 0,
        validExperiences: workExp?.validExperiences || 0,
      },

      // Admission
      admission: {
        hasAdmission: admissions && admissions.length > 0,
        admissionDetails: admissions?.[0]
          ? {
              university: admissions[0].universityName,
              program: admissions[0].programName,
              country: admissions[0].country,
              status: admissions[0].status,
              score: admissions[0].universityScore,
            }
          : null,
      },

      // Co-Borrowers
      coBorrowers: {
        total: coBorrowers.length,
        verified: coBorrowers.filter((cb) => cb.kycStatus === "verified")
          .length,
        withFinancials: coBorrowers.filter(
          (cb) =>
            cb.financialVerificationStatus === "verified" ||
            cb.financialVerificationStatus === "partial"
        ).length,
        list: coBorrowers.map((cb) => ({
          name: cb.fullName,
          relation: cb.relationToStudent,
          kycStatus: cb.kycStatus,
          financialStatus: cb.financialVerificationStatus,
        })),
      },

      // Loan Requests
      loanRequests: {
        total: loanRequests.length,
        pending: loanRequests.filter((lr) => lr.status === "pending").length,
        approved: loanRequests.filter((lr) => lr.status === "approved").length,
        rejected: loanRequests.filter((lr) => lr.status === "rejected").length,
        list: loanRequests.map((lr) => ({
          nbfc: lr.nbfc?.companyName,
          status: lr.status,
          createdAt: lr.createdAt,
        })),
      },

      // Completion Summary
      completion: completionStatus,
    };
  } catch (error) {
    console.error("❌ [getUserContext] Error:", error);
    return null;
  }
}

/**
 * Calculate application completion percentage
 */
function calculateCompletion(data) {
  const {
    student,
    educationPlan,
    academics,
    testScores,
    workExp,
    admissions,
    coBorrowers,
  } = data;

  const checks = {
    kycVerified: student.kycStatus === "verified",
    hasEducationPlan: !!educationPlan,
    hasAcademics:
      !!academics?.class10?.documentUrl && !!academics?.class12?.documentUrl,
    hasAdmission: admissions && admissions.length > 0,
    hasCoBorrowerKYC:
      coBorrowers.filter((cb) => cb.kycStatus === "verified").length > 0,
    hasCoBorrowerFinancial:
      coBorrowers.filter(
        (cb) =>
          cb.financialVerificationStatus === "verified" ||
          cb.financialVerificationStatus === "partial"
      ).length > 0,
  };

  const completed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  const percentage = Math.round((completed / total) * 100);

  // Find what's missing
  const missing = [];
  if (!checks.kycVerified) missing.push("KYC verification");
  if (!checks.hasEducationPlan) missing.push("Education plan");
  if (!checks.hasAcademics) missing.push("Academic documents");
  if (!checks.hasAdmission) missing.push("Admission letter");
  if (!checks.hasCoBorrowerKYC) missing.push("Co-borrower KYC");
  if (!checks.hasCoBorrowerFinancial)
    missing.push("Co-borrower financial documents");

  return {
    percentage,
    completed,
    total,
    isComplete: percentage === 100,
    missing,
    nextStep: missing[0] || "All done! You can now apply for loans",
  };
}

module.exports = {
  getUserContext,
};
