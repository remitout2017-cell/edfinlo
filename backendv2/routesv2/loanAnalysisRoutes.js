// routesv2/loanAnalysisRoutes.js

const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();
const loanAnalysisController = require("../controllersv2/loanAnalysisController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");

// Always-on limiter for analysis endpoints (works in dev + prod)
const loanAnalysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many loan analysis requests. Please try again later.",
    code: "LOAN_ANALYSIS_RATE_LIMIT",
  },
});

// Run comprehensive loan analysis (student-only)
router.post(
  "/analyze",
  protect,
  restrictTo("student"),
  loanAnalysisLimiter,
  loanAnalysisController.runLoanAnalysisV2
);

// Get analysis history (student-only)
router.get(
  "/history",
  protect,
  restrictTo("student"),
  loanAnalysisController.getAnalysisHistoryV2
);

// Get specific analysis details (student-only)
router.get(
  "/:analysisId",
  protect,
  restrictTo("student"),
  loanAnalysisController.getAnalysisDetailsV2
);

module.exports = router;
