// routes/students/workexperience.routes.js

const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/authMiddleware");
const authorize = require("../../middleware/authorize");
const upload = require("../../middleware/imageUpload");

const workExperienceController = require("../../controllers/students/workexperience.controller");

// All routes require authentication
router.use(authMiddleware);
router.use(authorize("student"));

/**
 * @route   POST /api/user/workexperience/submit
 * @desc    Submit work experience documents for AI extraction
 * @access  Private (Student only)
 * @body    Files:
 *          - experience_letters: PDF files (MANDATORY)
 *          - offer_letters: PDF files (OPTIONAL)
 *          - relieving_letters: PDF files (OPTIONAL)
 *          - salary_slips: PDF files (OPTIONAL)
 *          - other_documents: PDF files (OPTIONAL)
 */
router.post(
  "/submit",
  upload.fields([
    { name: "experience_letters", maxCount: 5 },
    { name: "offer_letters", maxCount: 3 },
    { name: "relieving_letters", maxCount: 3 },
    { name: "salary_slips", maxCount: 5 },
    { name: "other_documents", maxCount: 5 },
  ]),
  workExperienceController.submitWorkExperience
);

/**
 * @route   GET /api/user/workexperience/me
 * @desc    Get current user's work experience record
 * @access  Private (Student only)
 */
router.get("/me", workExperienceController.getWorkExperience);

/**
 * @route   DELETE /api/user/workexperience/me
 * @desc    Delete current user's work experience record
 * @access  Private (Student only)
 */
router.delete("/me", workExperienceController.deleteWorkExperience);

/**
 * @route   GET /api/user/workexperience/health
 * @desc    Check if Python work agent is reachable
 * @access  Private (Student only)
 */
router.get("/health", workExperienceController.healthCheck);

module.exports = router;
