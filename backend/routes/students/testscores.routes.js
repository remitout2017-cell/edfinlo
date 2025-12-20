// routes/students/testscores.routes.js - SMART SINGLE ROUTE

const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/authMiddleware");
const authorize = require("../../middleware/authorize");
const upload = require("../../middleware/imageUpload");

const {
  smartExtract,
  getTestScores,
  deleteTestScore,
  healthCheck,
} = require("../../controllers/students/testscores.controller");

// ========== PUBLIC ROUTES ==========

/**
 * @route   GET /api/user/testscores/health
 * @desc    Check Python test score server health
 * @access  Public
 */
router.get("/health", healthCheck);

// ========== PROTECTED ROUTES ==========

router.use(authMiddleware);
router.use(authorize("student"));

/**
 * @route   POST /api/user/testscores/extract
 * @desc    🎯 SMART EXTRACTION - Upload any combination of test scores
 * @access  Private (Student)
 * @body    FormData with optional files:
 *          - toefl_report (PDF/PNG/JPG)
 *          - gre_report (PDF/PNG/JPG)
 *          - ielts_report (PDF/PNG/JPG)
 * 
 * Examples:
 * - Upload only TOEFL: { toefl_report: file }
 * - Upload only GRE: { gre_report: file }
 * - Upload all three: { toefl_report: file1, gre_report: file2, ielts_report: file3 }
 * - Upload TOEFL + GRE: { toefl_report: file1, gre_report: file2 }
 */
router.post(
  "/extract",
  upload.fields([
    { name: "toefl_report", maxCount: 1 },
    { name: "gre_report", maxCount: 1 },
    { name: "ielts_report", maxCount: 1 },
  ]),
  smartExtract
);

/**
 * @route   GET /api/user/testscores
 * @desc    Get all test scores for logged-in student
 * @access  Private (Student)
 */
router.get("/", getTestScores);

/**
 * @route   DELETE /api/user/testscores/:testType
 * @desc    Delete a specific test score
 * @access  Private (Student)
 * @params  testType - 'toefl', 'gre', or 'ielts'
 */
router.delete("/:testType", deleteTestScore);

module.exports = router;