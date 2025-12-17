// routes/admissionRoutes.js - V2 WITH LANGGRAPH WORKFLOW
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { iskycverified } = require("../middlewares/iskycverified");
const upload = require("../middlewares/imageUpload");
const { aiRateLimiter } = require("../middlewares/aiRateLimit");

// V2 Controller (NEW LangGraph workflow)
const {
  uploadAdmissionLetterV2,
  getAdmissionLetterV2,
  deleteAdmissionLetterV2,
} = require("../controllers/admissionAnalysisControllerV2");

// V1 Controller (Fallback - Original)
const {
  analyzeAdmissionLetterController,
} = require("../controllers/admissionAnalysiscontroller");

// ============================================================================
// V2 ROUTES - Enhanced Admission Letter with LangGraph Workflow
// ============================================================================

/**
 * @route   POST /api/admission/upload
 * @desc    Upload admission letter with AI analysis (V2)
 * @access  Private (Student) - KYC verified required
 */
router.post(
  "/upload",
  protect,
  iskycverified,
  aiRateLimiter,
  upload.single("admissionLetter"),
  uploadAdmissionLetterV2
);

/**
 * @route   GET /api/admission/my-admission
 * @desc    Get admission letter details
 * @access  Private (Student)
 */
router.get("/my-admission", protect, getAdmissionLetterV2);

/**
 * @route   DELETE /api/admission/my-admission
 * @desc    Delete admission letter
 * @access  Private (Student)
 */
router.delete("/my-admission", protect, deleteAdmissionLetterV2);

// ============================================================================
// V1 ROUTE (Fallback - Original)
// ============================================================================

/**
 * @route   POST /api/admission/analyze
 * @desc    Analyze admission letter (V1 - Deprecated)
 * @access  Private (Student)
 */
router.post(
  "/analyze",
  protect,
  upload.single("admissionLetter"),
  analyzeAdmissionLetterController
);

module.exports = router;
