// routes/students/loanMatching.routes.js
const express = require("express");
const router = express.Router();

const auth = require("../../middleware/authMiddleware");
const authorize = require("../../middleware/authorize");

const {
  analyzeNBFCMatches,
  sendLoanRequestToNBFC,
  getMyLoanRequests,
  acceptNBFCOffer,
  getAnalysisHistory,
} = require("../../controllers/students/loanMatching.controller");

const {
  getDocumentCompleteness,
} = require("../../controllers/students/documentCompleteness.controller");

// All routes require student auth
router.use(auth);
router.use(authorize("student"));

/**
 * @route POST /api/student/loan-matching/analyze
 * @desc Run AI agent to match student with all NBFCs
 * @access Private (Student only)
 */
router.post("/analyze", analyzeNBFCMatches);

/**
 * @route POST /api/student/loan-matching/send-request/:nbfcId
 * @desc Send loan request to specific NBFC
 * @access Private (Student only)
 * @body { analysisId, message }
 */
router.post("/send-request/:nbfcId", sendLoanRequestToNBFC);

/**
 * @route GET /api/student/loan-matching/my-requests
 * @desc Get all loan requests sent by student
 * @access Private (Student only)
 */
router.get("/my-requests", getMyLoanRequests);

/**
 * @route POST /api/student/loan-matching/accept-offer/:requestId
 * @desc Accept approved NBFC offer
 * @access Private (Student only)
 */
router.post("/accept-offer/:requestId", acceptNBFCOffer);

/**
 * @route GET /api/loan-analysis/completeness
 * @desc Get document completeness status for student dashboard
 * @access Private (Student only)
 */
router.get("/completeness", getDocumentCompleteness);

/**
 * @route GET /api/student/loan-matching/history
 * @desc Get analysis history
 * @access Private (Student only)
 */
router.get("/history", getAnalysisHistory);

module.exports = router;
