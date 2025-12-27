const Consultant = require("../../models/consultant/Consultant");
const LoanAnalysisHistory = require("../../models/student/LoanAnalysisHistory");
const Student = require("../../models/student/students");
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");

// @desc    Get all loan analyses for students managed by consultant
// @route   GET /api/consultant/loan-analysis
// @access  Private (Consultant only)
exports.getConsultantLoanAnalyses = asyncHandler(async (req, res) => {
  const consultantId = req.user.id;

  // 1. Get consultant's students
  const consultant = await Consultant.findById(consultantId).select("students");
  if (!consultant) {
    throw new AppError("Consultant not found", 404);
  }

  // 2. Fetch analysis history for these students
  const analyses = await LoanAnalysisHistory.find({
    student: { $in: consultant.students },
  })
    .populate("student", "firstName lastName email avatar")
    .sort({ createdAt: -1 })
    .lean();

  // 3. Transform data for frontend
  const formattedAnalyses = analyses.map((analysis) => {
    // Determine recommendation based on eligibility
    let recommendation = "PENDING";
    let creditScore = 0; // Placeholder as actual credit score might be in student profile or nbfc data

    // Simple logic to determine recommendation from history
    // This assumes the analysis structure from loanMatching.controller.js
    if (analysis.overallSummary?.eligibleCount > 0) {
      recommendation = "APPROVED";
    } else if (analysis.overallSummary?.borderlineCount > 0) {
      recommendation = "REVIEW"; // Or partially approved
    } else {
      recommendation = "REJECTED";
    }

    // Try to get a mock credit score or real one if available
    // Analysis history doesn't strictly store credit score in the root, maybe in studentSnapshot
    // We'll use a placeholder or extract from snapshot if available
    const loanAmount =
      analysis.studentSnapshot?.studyPlan?.requestedLoanAmount || 0;

    // For UI display purposes (matching frontend expectations):
    return {
      _id: analysis._id,
      studentName: `${analysis.student?.firstName} ${analysis.student?.lastName}`,
      studentEmail: analysis.student?.email,
      loanAmount: loanAmount,
      recommendation: recommendation,
      interestRate:
        analysis.nbfcMatches?.eligible?.[0]?.analysis?.interestRate || 0, // Mock/First eligible
      loanTenure: analysis.studentSnapshot?.studyPlan?.repaymentPeriod || 0,
      monthlyEMI: 0, // Calculation required or pull from analysis
      totalPayable: 0,
      creditScore: 750, // Mock for now as it's not directly in history
      createdAt: analysis.createdAt,
    };
  });

  res.status(200).json({
    success: true,
    data: {
      analyses: formattedAnalyses,
      count: formattedAnalyses.length,
    },
  });
});

// @desc    Delete a loan analysis
// @route   DELETE /api/consultant/loan-analysis/:id
// @access  Private (Consultant only)
exports.deleteAnalysis = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const consultantId = req.user.id;

  // 1. Verify consultant has access to this student's analysis
  const analysis = await LoanAnalysisHistory.findById(id);
  if (!analysis) {
    throw new AppError("Analysis not found", 404);
  }

  const consultant = await Consultant.findOne({
    _id: consultantId,
    students: analysis.student,
  });

  if (!consultant) {
    throw new AppError("Not authorized to delete this analysis", 403);
  }

  // 2. Delete
  await LoanAnalysisHistory.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Analysis deleted successfully",
  });
});

// @desc    Get dashboard stats
// @route   GET /api/consultant/dashboard/stats
// @access  Private (Consultant only)
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const consultantId = req.user.id;
  const consultant = await Consultant.findById(consultantId).select(
    "students stats"
  );

  if (!consultant) {
    throw new AppError("Consultant not found", 404);
  }

  // Calculate specific stats for the dashboard
  const totalLoanAmount = 0; // Needs calculation from active loans
  const approvedLoans = 0; // Needs calculation from statuses
  const avgCreditScore = 0;
  const totalAnalysis = await LoanAnalysisHistory.countDocuments({
    student: { $in: consultant.students },
  });

  res.status(200).json({
    success: true,
    data: {
      totalAnalysis,
      totalLoanAmount: 15000000, // Mock for demo until real loan data is linked
      approvedLoans: 12, // Mock
      avgCreditScore: 765, // Mock
      ...consultant.stats,
    },
  });
});
