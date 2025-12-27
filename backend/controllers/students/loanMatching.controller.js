// controllers/students/loanMatching.controller.js
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");
const { aggregateStudentData } = require("../../agents/studentDataAggregator");
const { matchStudentWithAllNBFCs } = require("../../agents/nbfcMatcher");
const NBFC = require("../../models/nbfc/NBFC");
const LoanRequest = require("../../models/student/LoanRequest");
const LoanAnalysisHistory = require("../../models/student/LoanAnalysisHistory");

/**
 * GET NBFC Matches for Student
 * POST /api/student/loan-matching/analyze
 */
const analyzeNBFCMatches = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  console.log(`\n${"=".repeat(80)}`);
  console.log(`🎯 Starting NBFC matching for student: ${studentId}`);
  console.log(`${"=".repeat(80)}\n`);

  // 1. Aggregate student data
  console.log("📊 Step 1: Aggregating student data...");
  const studentProfile = await aggregateStudentData(studentId);

  // Validate minimum data
  if (studentProfile.personal.kycStatus !== "verified") {
    throw new AppError("KYC verification required before loan matching", 400);
  }

  if (!studentProfile.coBorrowers || studentProfile.coBorrowers.length === 0) {
    throw new AppError("At least one verified co-borrower required", 400);
  }

  if (
    !studentProfile.admissionLetters ||
    studentProfile.admissionLetters.length === 0
  ) {
    throw new AppError("At least one admission letter required", 400);
  }

  // 2. Fetch all active NBFCs
  console.log("🏦 Step 2: Fetching active NBFCs...");
  const nbfcs = await NBFC.find({
    isActive: true,
    "loanConfig.enabled": true,
  }).lean();

  if (!nbfcs.length) {
    throw new AppError("No active NBFCs available at the moment", 404);
  }

  console.log(`Found ${nbfcs.length} active NBFCs`);

  // 3. Run AI matching
  console.log("🤖 Step 3: Running AI matching agent...");
  const matchingResults = await matchStudentWithAllNBFCs(studentProfile, nbfcs);

  // 4. Save to history
  console.log("💾 Step 4: Saving analysis to history...");
  const analysisHistory = await LoanAnalysisHistory.create({
    student: studentId,
    studentSnapshot: {
      name: studentProfile.personal.name,
      email: studentProfile.personal.email,
      kycStatus: studentProfile.personal.kycStatus,
      studyPlan: studentProfile.studyPlan,
    },
    nbfcMatches: {
      eligible: matchingResults.eligible.map((m) => ({
        nbfcId: m.nbfcId,
        nbfcName: m.nbfcName,
        matchPercentage: m.matchPercentage,
        eligibilityStatus: m.eligibilityStatus,
        analysis: m.analysis,
      })),
      borderline: matchingResults.borderline.map((m) => ({
        nbfcId: m.nbfcId,
        nbfcName: m.nbfcName,
        matchPercentage: m.matchPercentage,
        eligibilityStatus: m.eligibilityStatus,
        analysis: m.analysis,
      })),
      notEligible: matchingResults.notEligible.map((m) => ({
        nbfcId: m.nbfcId,
        nbfcName: m.nbfcName,
        matchPercentage: m.matchPercentage,
        eligibilityStatus: m.eligibilityStatus,
        analysis: m.analysis,
      })),
    },
    overallSummary: {
      totalNBFCsAnalyzed: nbfcs.length,
      eligibleCount: matchingResults.eligible.length,
      borderlineCount: matchingResults.borderline.length,
      notEligibleCount: matchingResults.notEligible.length,
      topMatchNBFC: matchingResults.summary.topMatch?.nbfcName,
      topMatchPercentage: matchingResults.summary.topMatch?.matchPercentage,
    },
    analysisMetadata: {
      agentVersion: "1.0.0",
      llmModel: "llama-3.3-70b-versatile",
      processingTimeSeconds: 0, // Calculate if needed
    },
  });

  console.log(`✅ Analysis saved with ID: ${analysisHistory._id}\n`);

  // 5. Return results
  return res.status(200).json({
    success: true,
    message: "NBFC matching analysis completed",
    analysisId: analysisHistory._id,
    results: {
      eligible: matchingResults.eligible,
      borderline: matchingResults.borderline,
      notEligible: matchingResults.notEligible,
      summary: matchingResults.summary,
    },
  });
});

/**
 * Send Loan Request to NBFC
 * POST /api/student/loan-matching/send-request/:nbfcId
 */
const sendLoanRequestToNBFC = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  const { nbfcId } = req.params;
  const { analysisId, message } = req.body;

  if (!studentId) throw new AppError("Unauthorized", 401);

  // 1. Verify NBFC exists and is active
  const nbfc = await NBFC.findOne({ _id: nbfcId, isActive: true });
  if (!nbfc) throw new AppError("NBFC not found or inactive", 404);

  // 2. Check if request already exists
  const existingRequest = await LoanRequest.findOne({
    student: studentId,
    nbfc: nbfcId,
    status: { $in: ["pending", "approved"] },
  });

  if (existingRequest) {
    throw new AppError(
      "You already have an active request with this NBFC",
      400
    );
  }

  // 3. Get analysis snapshot
  let analysisSnapshot = null;
  if (analysisId) {
    analysisSnapshot = await LoanAnalysisHistory.findOne({
      _id: analysisId,
      student: studentId,
    });
  }

  // Find matching data from analysis
  let matchData = null;
  if (analysisSnapshot) {
    const allMatches = [
      ...analysisSnapshot.nbfcMatches.eligible,
      ...analysisSnapshot.nbfcMatches.borderline,
      ...analysisSnapshot.nbfcMatches.notEligible,
    ];
    matchData = allMatches.find((m) => m.nbfcId.toString() === nbfcId);
  }

  // 4. Aggregate fresh student data
  const studentProfile = await aggregateStudentData(studentId);

  // 5. Create loan request
  const loanRequest = await LoanRequest.create({
    student: studentId,
    nbfc: nbfcId,
    analysisHistory: analysisId || null,
    status: "pending",
    studentMessage: message || "",
    snapshot: {
      student: {
        name: studentProfile.personal.name,
        email: studentProfile.personal.email,
        phoneNumber: studentProfile.personal.phone,
      },
      eligibility: matchData
        ? {
            overallScore: matchData.matchPercentage,
            statusLabel: matchData.eligibilityStatus,
            eligibleLoanAmountMin: 0, // Can calculate based on income
            eligibleLoanAmountMax:
              studentProfile.studyPlan?.requestedLoanAmount || 0,
          }
        : null,
      nbfcMatch: matchData
        ? {
            nbfcId: nbfc._id,
            nbfcName: nbfc.companyName,
            matchPercentage: matchData.matchPercentage,
            eligibilityStatus: matchData.eligibilityStatus,
          }
        : null,
    },
  });

  // 6. Update NBFC stats
  await NBFC.findByIdAndUpdate(nbfcId, {
    $inc: { "stats.totalApplications": 1, "stats.pendingApplications": 1 },
  });

  console.log(`✅ Loan request sent to ${nbfc.companyName}`);

  return res.status(201).json({
    success: true,
    message: `Loan request sent to ${nbfc.companyName}`,
    requestId: loanRequest._id,
    nbfcName: nbfc.companyName,
  });
});

/**
 * Get Student's Loan Request History
 * GET /api/student/loan-matching/my-requests
 */
const getMyLoanRequests = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const requests = await LoanRequest.find({ student: studentId })
    .populate("nbfc", "companyName email contactPerson")
    .sort({ createdAt: -1 })
    .lean();

  return res.json({
    success: true,
    count: requests.length,
    requests,
  });
});

/**
 * Accept NBFC Offer
 * POST /api/student/loan-matching/accept-offer/:requestId
 */
const acceptNBFCOffer = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  const { requestId } = req.params;

  const request = await LoanRequest.findOne({
    _id: requestId,
    student: studentId,
    status: "approved",
  });

  if (!request) {
    throw new AppError("Approved loan request not found", 404);
  }

  if (request.studentAcceptance?.accepted) {
    throw new AppError("Offer already accepted", 400);
  }

  request.studentAcceptance = {
    accepted: true,
    acceptedAt: new Date(),
  };

  await request.save();

  return res.json({
    success: true,
    message: "Offer accepted successfully",
    request,
  });
});

/**
 * Get Analysis History
 * GET /api/student/loan-matching/history
 */
const getAnalysisHistory = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const history = await LoanAnalysisHistory.find({ student: studentId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return res.json({
    success: true,
    count: history.length,
    history,
  });
});

/**
 * DELETE Loan Analysis History Item
 * DELETE /api/student/loan-matching/history/:id
 */
const deleteAnalysis = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  const { id } = req.params;

  if (!studentId) throw new AppError("Unauthorized", 401);

  const historyItem = await LoanAnalysisHistory.findOneAndDelete({
    _id: id,
    student: studentId,
  });

  if (!historyItem) {
    throw new AppError("Analysis history item not found", 404);
  }

  return res.json({
    success: true,
    message: "Analysis history item deleted successfully",
  });
});

module.exports = {
  analyzeNBFCMatches,
  sendLoanRequestToNBFC,
  getMyLoanRequests,
  acceptNBFCOffer,
  getAnalysisHistory,
  deleteAnalysis,
};
