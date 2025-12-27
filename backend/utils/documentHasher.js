// utils/documentHasher.js (NEW FILE)
const crypto = require("crypto");

/**
 * Generates a hash of all student documents to detect changes
 */
const generateStudentDocumentHash = async (studentId) => {
  const Student = require("../models/student/students");
  const CoBorrower = require("../models/student/CoBorrower");

  // Fetch only IDs and updatedAt timestamps
  const student = await Student.findById(studentId)
    .select(
      "academicRecords testScores workExperience admissionLetters studyPlan kycStatus"
    )
    .populate("academicRecords", "updatedAt")
    .populate("testScores", "updatedAt")
    .populate("workExperience", "updatedAt")
    .populate("admissionLetters", "updatedAt")
    .lean();

  if (!student) return null;

  const coBorrowers = await CoBorrower.find({
    student: studentId,
    isDeleted: false,
  })
    .select("updatedAt financialSummary kycStatus")
    .lean();

  // Create hash from all relevant data timestamps and key fields
  const hashData = {
    academicRecords: student.academicRecords?.updatedAt || null,
    testScores: student.testScores?.updatedAt || null,
    workExperience: student.workExperience?.updatedAt || null,
    admissionLetters: student.admissionLetters?.map((a) => a.updatedAt) || [],
    studyPlan: student.studyPlan?.updatedAt || null,
    kycStatus: student.kycStatus,
    coBorrowers: coBorrowers.map((cb) => ({
      updated: cb.updatedAt,
      kyc: cb.kycStatus,
      hasFinancial: !!cb.financialSummary,
    })),
  };

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(hashData))
    .digest("hex");

  return hash;
};

/**
 * Update student's document hash
 */
const updateStudentDocumentHash = async (studentId) => {
  const Student = require("../models/student/students");
  const hash = await generateStudentDocumentHash(studentId);

  await Student.findByIdAndUpdate(studentId, {
    documentHash: hash,
    lastDocumentUpdate: new Date(),
  });

  return hash;
};

module.exports = {
  generateStudentDocumentHash,
  updateStudentDocumentHash,
};
