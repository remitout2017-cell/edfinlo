// controllers/loanRequestController.js
const LoanRequest = require("../models/LoanRequest");
const LoanAnalysisHistory = require("../models/LoanAnalysisHistory");
const NBFC = require("../models/NBFC");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");
const { enqueueNotification } = require("../services/notificationService");
const Student = require("../models/students");
const Admin = require("../models/Admin"); // <-- add

/**
 * @desc Get all loan requests for the current student
 * @route GET /api/loan-requests/student
 * @access Private (Student)
 */
exports.getStudentRequests = asyncHandler(async (req, res, next) => {
  const studentId = req.user._id;
  const { status, page = 1, limit = 20 } = req.query;

  console.log(`📋 Fetching loan requests for student: ${studentId}`);

  const query = { student: studentId };
  if (status) {
    query.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [requests, total] = await Promise.all([
    LoanRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("nbfc", "companyName brandName email loanConfig")
      .populate("analysisHistory", "overallScore createdAt")
      .lean(),
    LoanRequest.countDocuments(query),
  ]);

  console.log(
    `✅ Found ${requests.length} loan requests for student ${studentId}`
  );

  res.status(200).json({
    success: true,
    count: requests.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
    data: requests,
  });
});

/**
 * @desc Student sends loan request to a specific eligible NBFC
 * @route POST /api/loan-requests
 * @access Private (Student)
 * body: { nbfcId, analysisHistoryId? }
 */
exports.createLoanRequest = asyncHandler(async (req, res, next) => {
  const studentId = req.user._id;
  const { nbfcId, analysisHistoryId } = req.body;

  if (!nbfcId) {
    throw new AppError("nbfcId is required", 400);
  }

  // 1. Validate NBFC
  const nbfc = await NBFC.findOne({
    _id: nbfcId,
    isActive: true,
    isApprovedByAdmin: true,
    "loanConfig.enabled": true,
  })
    .select("companyName brandName email")
    .lean();

  if (!nbfc) {
    throw new AppError("NBFC not found or not active/approved", 404);
  }

  // 2. Get latest analysis history (or use provided one)
  let analysisHistory;
  if (analysisHistoryId) {
    analysisHistory = await LoanAnalysisHistory.findOne({
      _id: analysisHistoryId,
      student: studentId,
    }).lean();
  } else {
    analysisHistory = await LoanAnalysisHistory.findOne({ student: studentId })
      .sort({ createdAt: -1 })
      .lean();
  }

  if (!analysisHistory) {
    throw new AppError(
      "Loan analysis not found. Please run loan analysis before sending request.",
      400
    );
  }

  // Choose the matching summary for this NBFC from analysis (if present)
  let nbfcMatch = null;
  if (analysisHistory.nbfcMatches?.eligible?.length) {
    nbfcMatch =
      analysisHistory.nbfcMatches.eligible.find(
        (m) => String(m.nbfcId) === String(nbfcId)
      ) || null;
  }
  if (!nbfcMatch && analysisHistory.nbfcMatches?.borderline?.length) {
    nbfcMatch =
      analysisHistory.nbfcMatches.borderline.find(
        (m) => String(m.nbfcId) === String(nbfcId)
      ) || null;
  }

  if (!nbfcMatch) {
    // optional strictness: block if student not matched as eligible/borderline
    throw new AppError(
      "This NBFC is not in your eligible or borderline match list. Please choose an eligible NBFC.",
      400
    );
  }

  // 3. Prevent duplicate pending request to same NBFC
  const existingPending = await LoanRequest.findOne({
    student: studentId,
    nbfc: nbfcId,
    status: "pending",
  });
  if (existingPending) {
    throw new AppError(
      "You already have a pending request with this NBFC.",
      400
    );
  }

  // 4. Build snapshot from analysis
  const snapshot = {
    student: {
      name: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
      email: req.user.email,
      phoneNumber: req.user.phoneNumber,
    },
    eligibility: {
      overallScore: analysisHistory.overallScore,
      statusLabel: analysisHistory.overallScore
        ? // simple mapping consistent with getScoreStatus
          analysisHistory.overallScore >= 80
          ? "Excellent"
          : analysisHistory.overallScore >= 60
          ? "Good"
          : analysisHistory.overallScore >= 40
          ? "Fair"
          : "Needs Improvement"
        : null,
      eligibleLoanAmountMin: nbfcMatch.estimatedLoanAmount?.min || null,
      eligibleLoanAmountMax: nbfcMatch.estimatedLoanAmount?.max || null,
    },
    nbfcMatch: {
      nbfcId: nbfcMatch.nbfcId,
      nbfcName: nbfcMatch.nbfcName,
      brandName: nbfcMatch.brandName,
      matchPercentage: nbfcMatch.matchPercentage,
      eligibilityStatus: nbfcMatch.eligibilityStatus,
    },
  };

  // 5. Create LoanRequest
  const loanRequest = await LoanRequest.create({
    student: studentId,
    nbfc: nbfcId,
    analysisHistory: analysisHistory._id,
    status: "pending",
    snapshot,
  });

  // 6. Notify NBFC via BullMQ
  try {
    await enqueueNotification({
      recipientId: nbfcId.toString(),
      recipientModel: "NBFC",
      type: "STUDENT_SENT_REQUEST",
      title: "New loan request",
      message: `${
        snapshot.student.name || snapshot.student.email
      } has requested a loan from your NBFC.`,
      data: {
        loanRequestId: loanRequest._id.toString(),
        studentId: studentId.toString(),
        analysisHistoryId: analysisHistory._id.toString(),
        matchPercentage: snapshot.nbfcMatch.matchPercentage,
        eligibilityStatus: snapshot.nbfcMatch.eligibilityStatus,
      },
    });
  } catch (err) {
    console.error(
      "⚠️ Failed to enqueue NBFC notification for loan request:",
      err.message
    );
  }

  res.status(201).json({
    success: true,
    message: "Loan request sent to NBFC successfully",
    data: loanRequest,
  });
});

/**
 * @desc Student accepts an approved NBFC offer
 * @route POST /api/loan-requests/:id/accept
 * @access Private (Student)
 */
exports.acceptLoanOffer = asyncHandler(async (req, res, next) => {
  const studentId = req.user._id;
  const { id } = req.params;

  // 1. Ensure this request belongs to the student and is approved
  const request = await LoanRequest.findOne({
    _id: id,
    student: studentId,
  });

  if (!request) {
    throw new AppError("Loan request not found for this student", 404);
  }

  if (request.status !== "approved") {
    throw new AppError(
      "You can only accept an offer that has been approved by the NBFC.",
      400
    );
  }

  if (request.studentAcceptance?.accepted) {
    throw new AppError("You have already accepted this offer.", 400);
  }

  // 2. Mark this request as accepted by student
  request.studentAcceptance = {
    accepted: true,
    acceptedAt: new Date(),
  };

  await request.save();

  // 3. Optionally cancel other pending requests for this student
  //    so only ONE NBFC is in 'approved+accepted' state.
  try {
    await LoanRequest.updateMany(
      {
        student: studentId,
        _id: { $ne: request._id },
        status: "pending",
      },
      { $set: { status: "cancelled" } }
    );
  } catch (err) {
    console.warn(
      "⚠️ Failed to cancel other pending loan requests:",
      err.message
    );
  }

  // 4. Notify NBFC
  try {
    await enqueueNotification({
      recipientId: request.nbfc.toString(),
      recipientModel: "NBFC",
      type: "STUDENT_ACCEPTED_OFFER",
      title: "Student accepted your loan offer",
      message: `${
        request.snapshot.student.name || request.snapshot.student.email
      } has accepted your loan offer.`,
      data: {
        loanRequestId: request._id.toString(),
        studentId: studentId.toString(),
        studentName: request.snapshot.student.name,
        nbfcName: request.snapshot.nbfcMatch.nbfcName,
        offeredAmount: request.nbfcDecision?.offeredAmount || null,
        offeredRoi: request.nbfcDecision?.offeredRoi || null,
      },
    });
  } catch (err) {
    console.error(
      "⚠️ Failed to enqueue NBFC notification for student acceptance:",
      err.message
    );
  }

  // 5. Notify all active admins
  try {
    const admins = await Admin.find({ isActive: true }).select(
      "_id role email"
    );
    await Promise.all(
      admins.map((admin) =>
        enqueueNotification({
          recipientId: admin._id.toString(),
          recipientModel: "Admin",
          type: "STUDENT_ACCEPTED_OFFER",
          title: "Student chose an NBFC offer",
          message: `${
            request.snapshot.student.name || request.snapshot.student.email
          } has accepted the offer from ${
            request.snapshot.nbfcMatch.nbfcName
          }.`,
          data: {
            loanRequestId: request._id.toString(),
            studentId: studentId.toString(),
            studentName: request.snapshot.student.name,
            nbfcId: request.nbfc.toString(),
            nbfcName: request.snapshot.nbfcMatch.nbfcName,
            adminRole: admin.role,
          },
        })
      )
    );
  } catch (err) {
    console.error(
      "⚠️ Failed to enqueue admin notifications for student acceptance:",
      err.message
    );
  }

  res.status(200).json({
    success: true,
    message: "Offer accepted successfully",
    data: request,
  });
});

/**
 * @desc NBFC: list loan requests sent to this NBFC
 * @route GET /api/loan-requests/nbfc
 * @access Private (NBFC)
 * query: status=pending|approved|rejected, page, limit
 */
exports.getNBFCRequests = asyncHandler(async (req, res, next) => {
  const nbfcId = req.user._id;
  const { status, page = 1, limit = 20 } = req.query;

  const query = { nbfc: nbfcId };
  if (status) {
    query.status = status;
  }

  const requests = await LoanRequest.find(query)
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .lean();

  const total = await LoanRequest.countDocuments(query);

  res.status(200).json({
    success: true,
    count: requests.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
    data: requests,
  });
});

/**
 * @desc NBFC: get one loan request details
 * @route GET /api/loan-requests/nbfc/:id
 * @access Private (NBFC)
 */
exports.getNBFCRequestById = asyncHandler(async (req, res, next) => {
  const nbfcId = req.user._id;
  const { id } = req.params;

  const request = await LoanRequest.findOne({
    _id: id,
    nbfc: nbfcId,
  })
    .populate("student", "firstName lastName email phoneNumber")
    .populate("analysisHistory")
    .lean();

  if (!request) {
    throw new AppError("Loan request not found", 404);
  }

  res.status(200).json({
    success: true,
    data: request,
  });
});

/**
 * @desc NBFC: approve or reject a loan request
 * @route POST /api/loan-requests/:id/decision
 * @access Private (NBFC)
 * body: { status: 'approved'|'rejected', offeredAmount?, offeredRoi?, reason? }
 */
exports.decideLoanRequest = asyncHandler(async (req, res, next) => {
  const nbfcId = req.user._id;
  const { id } = req.params;
  const { status, offeredAmount, offeredRoi, reason } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    throw new AppError("Status must be 'approved' or 'rejected'", 400);
  }

  // Only the NBFC that owns this request can decide, and only if pending
  const request = await LoanRequest.findOne({
    _id: id,
    nbfc: nbfcId,
    status: "pending",
  });

  if (!request) {
    throw new AppError("Pending loan request not found for this NBFC", 404);
  }

  request.status = status;
  request.nbfcDecision = {
    decidedAt: new Date(),
    decidedBy: nbfcId,
    reason: reason || null,
    offeredAmount: offeredAmount || null,
    offeredRoi: offeredRoi || null,
  };

  await request.save();

  // Optional: update NBFC stats
  try {
    const incFields =
      status === "approved"
        ? { approvedApplications: 1 }
        : { rejectedApplications: 1 };
    await NBFC.findByIdAndUpdate(nbfcId, {
      $inc: {
        "stats.totalApplications": 1,
        ...incFields,
      },
    });
  } catch (e) {
    console.warn("⚠️ Failed to update NBFC stats:", e.message);
  }

  // Fetch basic student info for notification
  const student = await Student.findById(request.student)
    .select("firstName lastName email")
    .lean();

  const studentName =
    `${student?.firstName || ""} ${student?.lastName || ""}`.trim() ||
    student?.email ||
    "Student";

  // Notify student
  try {
    await enqueueNotification({
      recipientId: request.student.toString(),
      recipientModel: "Student",
      type:
        status === "approved"
          ? "NBFC_APPROVED_REQUEST"
          : "NBFC_REJECTED_REQUEST",
      title:
        status === "approved"
          ? "Your loan request was approved"
          : "Your loan request was declined",
      message:
        status === "approved"
          ? `Your loan request to ${request.snapshot.nbfcMatch.nbfcName} has been approved.`
          : `Your loan request to ${request.snapshot.nbfcMatch.nbfcName} has been declined.`,
      data: {
        loanRequestId: request._id.toString(),
        nbfcId: nbfcId.toString(),
        nbfcName: request.snapshot.nbfcMatch.nbfcName,
        offeredAmount: offeredAmount || null,
        offeredRoi: offeredRoi || null,
        reason: reason || null,
      },
    });
  } catch (err) {
    console.error(
      "⚠️ Failed to enqueue student notification for NBFC decision:",
      err.message
    );
  }

  res.status(200).json({
    success: true,
    message:
      status === "approved"
        ? "Loan request approved successfully"
        : "Loan request rejected successfully",
    data: request,
  });
});
