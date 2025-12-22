// controllers/nbfc/loanRequest.controller.js
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");
const LoanRequest = require("../../models/student/LoanRequest");
const Student = require("../../models/student/students");
const AcademicRecords = require("../../models/student/AcademicRecords");
const TestScores = require("../../models/student/TestScores");
const WorkExperience = require("../../models/student/Workexperience");
const AdmissionLetter = require("../../models/student/AdmissionLetter");
const CoBorrower = require("../../models/student/CoBorrower");
const NBFC = require("../../models/nbfc/NBFC");

/**
 * Get All Loan Requests for NBFC
 * GET /api/nbfc/loan-requests
 */
const getAllLoanRequests = asyncHandler(async (req, res) => {
  const nbfcId = req.user?.id;
  if (!nbfcId) throw new AppError("Unauthorized", 401);

  const { status } = req.query;

  const filter = { nbfc: nbfcId };
  if (status) filter.status = status;

  const requests = await LoanRequest.find(filter)
    .populate(
      "student",
      "firstName lastName email phoneNumber kycStatus studyPlan"
    )
    .populate("analysisHistory")
    .sort({ createdAt: -1 })
    .lean();

  return res.json({
    success: true,
    count: requests.length,
    requests,
  });
});

/**
 * Get Single Loan Request with FULL Student Data
 * GET /api/nbfc/loan-requests/:requestId
 */
const getLoanRequestDetails = asyncHandler(async (req, res) => {
  const nbfcId = req.user?.id;
  const { requestId } = req.params;

  if (!nbfcId) throw new AppError("Unauthorized", 401);

  // Fetch request
  const request = await LoanRequest.findOne({
    _id: requestId,
    nbfc: nbfcId,
  })
    .populate("student")
    .populate("analysisHistory")
    .lean();

  if (!request) throw new AppError("Loan request not found", 404);

  const studentId = request.student._id;

  // Fetch ALL student documents (NBFC has access after student sends request)
  const [academics, testScores, workExp, admissions, coBorrowers] =
    await Promise.all([
      AcademicRecords.findOne({ student: studentId }).lean(),
      TestScores.findOne({ student: studentId }).lean(),
      WorkExperience.findOne({ student: studentId }).lean(),
      AdmissionLetter.find({ student: studentId }).lean(),
      CoBorrower.find({
        student: studentId,
        isDeleted: false,
        kycStatus: "verified",
      })
        .select("+financialDocuments +financialAnalysis +financialSummary")
        .lean(),
    ]);

  // Compile full profile
  const fullStudentProfile = {
    ...request.student,
    academicRecords: academics,
    testScores,
    workExperience: workExp,
    admissionLetters: admissions,
    coBorrowers,
  };

  return res.json({
    success: true,
    request: {
      ...request,
      student: fullStudentProfile,
    },
  });
});

/**
 * Approve/Reject Loan Request
 * PUT /api/nbfc/loan-requests/:requestId/decide
 */
const decideLoanRequest = asyncHandler(async (req, res) => {
  const nbfcId = req.user?.id;
  const { requestId } = req.params;
  const { decision, reason, offeredAmount, offeredRoi } = req.body;

  if (!nbfcId) throw new AppError("Unauthorized", 401);
  if (!["approved", "rejected"].includes(decision)) {
    throw new AppError("Decision must be 'approved' or 'rejected'", 400);
  }

  const request = await LoanRequest.findOne({
    _id: requestId,
    nbfc: nbfcId,
    status: "pending",
  });

  if (!request) throw new AppError("Pending loan request not found", 404);

  // Update request
  request.status = decision;
  request.nbfcDecision = {
    decidedAt: new Date(),
    decidedBy: nbfcId,
    reason: reason || "",
    offeredAmount: decision === "approved" ? offeredAmount : null,
    offeredRoi: decision === "approved" ? offeredRoi : null,
  };

  await request.save();

  // Update NBFC stats
  const statField =
    decision === "approved" ? "approvedApplications" : "rejectedApplications";

  await NBFC.findByIdAndUpdate(nbfcId, {
    $inc: {
      [`stats.${statField}`]: 1,
      "stats.pendingApplications": -1,
    },
  });

  return res.json({
    success: true,
    message: `Loan request ${decision}`,
    request,
  });
});

/**
 * Get NBFC Dashboard Stats
 * GET /api/nbfc/dashboard/stats
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const nbfcId = req.user?.id;
  if (!nbfcId) throw new AppError("Unauthorized", 401);

  const nbfc = await NBFC.findById(nbfcId).select("stats").lean();

  const recentRequests = await LoanRequest.find({ nbfc: nbfcId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("student", "firstName lastName email")
    .lean();

  return res.json({
    success: true,
    stats: nbfc.stats,
    recentRequests,
  });
});

module.exports = {
  getAllLoanRequests,
  getLoanRequestDetails,
  decideLoanRequest,
  getDashboardStats,
};
