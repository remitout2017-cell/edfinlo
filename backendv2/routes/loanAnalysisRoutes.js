// routes/loanAnalysisRoutes.js - FIXED

const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middlewares/authMiddleware");
const {
  analyzeLoanEligibility,
  analyzeEnhancedEligibility,
  getApplicationCompleteness,
  getAnalysisHistory,
  getAnalysisById,
  compareAnalyses,
  deleteAnalysisHistory,
  clearAnalysisCache,
} = require("../controllers/loanAnalysisController");

// All loan-analysis routes are for students
router.use(protect);
router.use(restrictTo("student"));

// Analysis endpoints
router.post("/analyze", analyzeLoanEligibility);
router.post("/analyze-enhanced", analyzeEnhancedEligibility);
router.get("/completeness", getApplicationCompleteness);
router.delete("/cache", clearAnalysisCache);

// History endpoints
router.get("/history", getAnalysisHistory);
router.get("/history/:analysisId", getAnalysisById);
router.delete("/history/:analysisId", deleteAnalysisHistory);
router.get("/compare/:analysisId1/:analysisId2", compareAnalyses);

module.exports = router;