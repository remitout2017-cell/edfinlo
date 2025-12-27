// agents/studentDataAggregator.js

const Student = require("../models/student/students");
const AcademicRecords = require("../models/student/AcademicRecords");
const TestScores = require("../models/student/TestScores");
const WorkExperience = require("../models/student/Workexperience");
const AdmissionLetter = require("../models/student/AdmissionLetter");
const CoBorrower = require("../models/student/CoBorrower");

const aggregateStudentData = async (studentId) => {
  try {
    // ✅ FIXED: Populate coBorrowers directly instead of separate query
    const student = await Student.findById(studentId)
      .populate("academicRecords")
      .populate("testScores")
      .populate("workExperience")
      .populate("admissionLetters")
      .populate({
        path: "coBorrowers",
        match: { isDeleted: false, kycStatus: "verified" },
        select: "+financialDocuments +financialAnalysis +financialSummary",
      })
      .lean();

    if (!student) throw new Error("Student not found");

    // ✅ No need for separate CoBorrower query now
    const coBorrowers = student.coBorrowers || [];

    // Format for AI (keep existing formatters)
    const profile = {
      personal: {
        name: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
        email: student.email,
        phone: student.phoneNumber,
        kycStatus: student.kycStatus,
      },
      academics: formatAcademics(student.academicRecords),
      testScores: formatTestScores(student.testScores),
      workExperience: formatWorkExperience(student.workExperience),
      admissionLetters: formatAdmissionLetters(student.admissionLetters),
      studyPlan: student.studyPlan || {},
      coBorrowers: formatCoBorrowers(coBorrowers),
      financialSummary: calculateFinancialSummary(coBorrowers),
    };

    return profile;
  } catch (error) {
    console.error("❌ Data aggregation error:", error);
    throw error;
  }
};

function formatAcademics(records) {
  if (!records) return { status: "not_provided" };

  return {
    tenthGrade: {
      percentage: records.tenthGrade?.percentageOrCgpa,
      board: records.tenthGrade?.board,
      year: records.tenthGrade?.yearOfPassing,
    },
    twelfthGrade: {
      percentage: records.twelfthGrade?.percentageOrCgpa,
      board: records.twelfthGrade?.board,
      year: records.twelfthGrade?.yearOfPassing,
    },
    graduation: {
      percentage: records.graduation?.percentageOrCgpa,
      degree: records.graduation?.degree,
      university: records.graduation?.university,
      year: records.graduation?.yearOfPassing,
    },
    postGraduation: records.postGraduation?.degree
      ? {
          percentage: records.postGraduation?.percentageOrCgpa,
          degree: records.postGraduation?.degree,
          university: records.postGraduation?.university,
          year: records.postGraduation?.yearOfPassing,
        }
      : null,
    gapYears: records.gapYears || 0,
  };
}

function formatTestScores(scores) {
  if (!scores) return { status: "not_provided" };

  return {
    ielts: scores.ielts?.overallScore,
    toefl: scores.toefl?.totalScore,
    gre: scores.gre?.totalScore,
    gmat: scores.gmat?.totalScore,
    pte: scores.pte?.overallScore,
  };
}

function formatWorkExperience(work) {
  if (!work || !work.workExperiences?.length) return { status: "not_provided" };

  return {
    totalYears: work.totalYearsExperience || 0,
    experiences: work.workExperiences.map((exp) => ({
      company: exp.companyName,
      position: exp.jobTitle,
      duration: `${exp.startDate} to ${exp.endDate || "Present"}`,
      monthlySalary: exp.stipendAmount,
    })),
  };
}

function formatAdmissionLetters(letters) {
  if (!letters || !letters.length) return { status: "not_provided" };

  return letters.map((letter) => ({
    university: letter.universityName,
    course: letter.courseName,
    country: letter.country,
    tuitionFee: letter.tuitionFee,
    intake: `${letter.intakeMonth} ${letter.intakeYear}`,
    status: letter.verificationStatus,
    // ✅ FIXED: Handle both nested and direct worldRank
    worldRank:
      letter.universityDetails?.worldRanking || letter.worldRanking || null,
  }));
}

function formatCoBorrowers(coBorrowers) {
  if (!coBorrowers?.length) return { status: "not_provided" };

  return coBorrowers.map((cb) => ({
    name: cb.fullName || `${cb.firstName} ${cb.lastName}`,
    relation: cb.relationToStudent,
    kycStatus: cb.kycStatus,
    financial: cb.financialSummary || {},
    cibilEstimate: cb.financialSummary?.cibilEstimate,
    avgMonthlyIncome: cb.financialSummary?.avgMonthlyIncome,
    avgMonthlySalary: cb.financialSummary?.avgMonthlySalary,
    foir: cb.financialSummary?.foir,
    // ✅ ADD NEW FIELDS:
    avgBankBalance: cb.financialSummary?.avgBankBalance,
    minBankBalance: cb.financialSummary?.minBankBalance,
    bounceCount: cb.financialSummary?.bounceCount,
  }));
}

function calculateFinancialSummary(coBorrowers) {
  if (!coBorrowers?.length) return { status: "not_provided" };

  // ✅ MODIFIED: Include all co-borrowers with financial data, not just "verified"
  // This allows the AI to analyze uploaded documents even if they aren't fully verified yet.
  const hasFinancials = coBorrowers.filter(
    (cb) => cb.financialSummary && Object.keys(cb.financialSummary).length > 0
  );

  if (!hasFinancials.length) return { status: "not_provided" };

  const totalMonthlyIncome = hasFinancials.reduce(
    (sum, cb) => sum + (cb.financialSummary?.avgMonthlyIncome || 0),
    0
  );

  const avgCibil =
    hasFinancials.reduce(
      (sum, cb) => sum + (cb.financialSummary?.cibilEstimate || 0),
      0
    ) / hasFinancials.length;

  const avgFoir =
    hasFinancials.reduce(
      (sum, cb) => sum + (cb.financialSummary?.foir || 0),
      0
    ) / hasFinancials.length;

  // ✅ ADD: Bank balance aggregation
  const avgBankBalance =
    hasFinancials.reduce(
      (sum, cb) => sum + (cb.financialSummary?.avgBankBalance || 0),
      0
    ) / hasFinancials.length;

  // ✅ ADD: Minimum balance (take the lowest across all co-borrowers)
  const minBankBalance = Math.min(
    ...hasFinancials.map(
      (cb) => cb.financialSummary?.minBankBalance || Infinity
    )
  );

  // ✅ ADD: Total bounce count (sum across all co-borrowers)
  const totalBounces = hasFinancials.reduce(
    (sum, cb) => sum + (cb.financialSummary?.bounceCount || 0),
    0
  );

  // ✅ ADD: Total dishonor count
  const totalDishonors = hasFinancials.reduce(
    (sum, cb) => sum + (cb.financialSummary?.dishonorCount || 0),
    0
  );

  // ✅ ADD: Total existing EMI
  const totalExistingEmi = hasFinancials.reduce(
    (sum, cb) => sum + (cb.financialSummary?.totalExistingEmi || 0),
    0
  );

  return {
    totalMonthlyCombinedIncome: Math.round(totalMonthlyIncome),
    avgAnnualIncome: Math.round(totalMonthlyIncome * 12),
    avgCibilScore: Math.round(avgCibil),
    avgFoir: Math.round(avgFoir),

    // ✅ ADD: New fields for NBFC matching
    avgBankBalance: Math.round(avgBankBalance),
    minBankBalance:
      minBankBalance === Infinity ? 0 : Math.round(minBankBalance),
    totalBounceCount: totalBounces,
    totalDishonorCount: totalDishonors,
    totalExistingEmi: Math.round(totalExistingEmi),

    verifiedCoBorrowers: hasFinancials.length,
  };
}

module.exports = { aggregateStudentData };
