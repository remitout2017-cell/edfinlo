// agents/studentDataAggregator.js
const Student = require("../models/student/students");
const AcademicRecords = require("../models/student/AcademicRecords");
const TestScores = require("../models/student/TestScores");
const WorkExperience = require("../models/student/Workexperience");
const AdmissionLetter = require("../models/student/AdmissionLetter");
const CoBorrower = require("../models/student/CoBorrower");

/**
 * Aggregates all student data for AI analysis
 */
const aggregateStudentData = async (studentId) => {
  try {
    // Fetch student with populated refs
    const student = await Student.findById(studentId)
      .populate("academicRecords")
      .populate("testScores")
      .populate("workExperience")
      .populate("admissionLetters")
      .lean();

    if (!student) throw new Error("Student not found");

    // Fetch co-borrowers with financial analysis
    const coBorrowers = await CoBorrower.find({
      student: studentId,
      isDeleted: false,
      kycStatus: "verified",
    })
      .select("+financialDocuments +financialAnalysis +financialSummary")
      .lean();

    // Format for AI
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
    postGraduation: records.postGraduation?.degree ? {
      percentage: records.postGraduation?.percentageOrCgpa,
      degree: records.postGraduation?.degree,
      university: records.postGraduation?.university,
      year: records.postGraduation?.yearOfPassing,
    } : null,
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
  if (!work || !work.experiences?.length) return { status: "not_provided" };
  
  return {
    totalYears: work.totalYearsOfExperience || 0,
    experiences: work.experiences.map(exp => ({
      company: exp.companyName,
      position: exp.position,
      duration: `${exp.startDate} to ${exp.endDate || "Present"}`,
      monthlySalary: exp.monthlySalary,
    })),
  };
}

function formatAdmissionLetters(letters) {
  if (!letters || !letters.length) return { status: "not_provided" };
  
  return letters.map(letter => ({
    university: letter.universityName,
    course: letter.courseName,
    country: letter.country,
    tuitionFee: letter.tuitionFee,
    intake: `${letter.intakeMonth} ${letter.intakeYear}`,
    status: letter.verificationStatus,
    worldRank: letter.universityDetails?.worldRanking,
  }));
}

function formatCoBorrowers(coBorrowers) {
  if (!coBorrowers?.length) return { status: "not_provided" };
  
  return coBorrowers.map(cb => ({
    name: cb.fullName || `${cb.firstName} ${cb.lastName}`,
    relation: cb.relationToStudent,
    kycStatus: cb.kycStatus,
    financial: cb.financialSummary || {},
    cibilEstimate: cb.financialSummary?.cibilEstimate,
    avgMonthlySalary: cb.financialSummary?.avgMonthlySalary,
    foir: cb.financialSummary?.foir,
  }));
}

function calculateFinancialSummary(coBorrowers) {
  if (!coBorrowers?.length) return { status: "not_provided" };
  
  const verified = coBorrowers.filter(cb => cb.financialVerificationStatus === "verified");
  
  if (!verified.length) return { status: "pending_verification" };
  
  const totalMonthlyIncome = verified.reduce((sum, cb) => 
    sum + (cb.financialSummary?.avgMonthlySalary || 0), 0
  );
  
  const avgCibil = verified.reduce((sum, cb) => 
    sum + (cb.financialSummary?.cibilEstimate || 0), 0
  ) / verified.length;
  
  const avgFoir = verified.reduce((sum, cb) => 
    sum + (cb.financialSummary?.foir || 0), 0
  ) / verified.length;
  
  return {
    totalMonthlyCombinedIncome: totalMonthlyIncome,
    avgAnnualIncome: totalMonthlyIncome * 12,
    avgCibilScore: Math.round(avgCibil),
    avgFoir: Math.round(avgFoir),
    verifiedCoBorrowers: verified.length,
  };
}

module.exports = { aggregateStudentData };
