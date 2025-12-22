// routes/nbfc/loanRequest.routes.js
const express = require("express");
const router = express.Router();

const auth = require("../../middleware/authMiddleware");
const authorize = require("../../middleware/authorize");

const {
  getAllLoanRequests,
  getLoanRequestDetails,
  decideLoanRequest,
  getDashboardStats,
} = require("../../controllers/nbfc/loanRequest.controller");

// All routes require NBFC auth
router.use(auth);
router.use(authorize("NBFC"));

/**
 * @route GET /api/nbfc/loan-requests
 * @desc Get all loan requests for NBFC (filter by ?status=pending)
 * @access Private (NBFC only)
 */
router.get("/", getAllLoanRequests);

/**
 * @route GET /api/nbfc/loan-requests/:requestId
 * @desc Get full student details for a loan request
 * @access Private (NBFC only)
 */
router.get("/:requestId", getLoanRequestDetails);

/**
 * @route PUT /api/nbfc/loan-requests/:requestId/decide
 * @desc Approve or reject loan request
 * @access Private (NBFC only)
 * @body { decision: "approved|rejected", reason, offeredAmount, offeredRoi }
 */
router.put("/:requestId/decide", decideLoanRequest);

/**
 * @route GET /api/nbfc/dashboard/stats
 * @desc Get NBFC dashboard statistics
 * @access Private (NBFC only)
 */
router.get("/dashboard/stats", getDashboardStats);

module.exports = router;
