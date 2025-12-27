const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const authorize = require("../../middleware/authorize");
const {
  getConsultantLoanAnalyses,
  deleteAnalysis,
  getDashboardStats,
} = require("../../controllers/consultant/consultant.analysis.controller");

// All routes require consultant authentication
router.use(authMiddleware);
router.use(authorize("consultant"));

router.get("/loan-analysis", getConsultantLoanAnalyses);
router.delete("/loan-analysis/:id", deleteAnalysis);
router.get("/dashboard/stats", getDashboardStats);

module.exports = router;
