// routes/academic.routes.js
const express = require("express");
const router = express.Router();
const {
  extractClass10,
  extractClass12,
  extractComplete,
  getAcademicRecords,
  deleteAcademicRecord,
  checkAcademicCompleteness,
  healthCheck,
} = require("../../controllers/students/academic.controller");
const authMiddleware = require("../../middleware/authMiddleware"); // ✅ Fixed import
const upload = require("../../middleware/imageUpload");

// Health check (public)
router.get("/health", healthCheck);

// Protected routes (require authentication)
router.use(authMiddleware); // ✅ Fixed usage - All routes below require authentication

/**
 * @route   POST /api/academic/extract/class10
 * @desc    Extract Class 10 marksheet only
 * @body    pdf_10th: File (PDF)
 */
router.post(
  "/extract/class10",
  upload.fields([{ name: "pdf_10th", maxCount: 1 }]),
  extractClass10
);

router.get("/:studentId/completeness", checkAcademicCompleteness);

/**
 * @route   POST /api/academic/extract/class12
 * @desc    Extract Class 12 marksheet only
 * @body    pdf_12th: File (PDF)
 */
router.post(
  "/extract/class12",
  upload.fields([{ name: "pdf_12th", maxCount: 1 }]),
  extractClass12
);

/**
 * @route   POST /api/academic/extract/complete
 * @desc    Extract complete academic record (10th + 12th + Graduation + Gap Analysis)
 * @body    pdf_10th: File (PDF) [Optional]
 *          pdf_12th: File (PDF) [Optional]
 *          pdf_graduation: File (PDF) [Optional]
 */
router.post(
  "/extract/complete",
  upload.fields([
    { name: "pdf_10th", maxCount: 1 },
    { name: "pdf_12th", maxCount: 1 },
    { name: "pdf_graduation", maxCount: 1 },
  ]),
  extractComplete
);

/**
 * @route   GET /api/academic/records
 * @desc    Get student's academic records
 */
router.get("/records", getAcademicRecords);

/**
 * @route   DELETE /api/academic/:recordType
 * @desc    Delete specific academic record (class10, class12, graduation)
 * @param   recordType: String
 */
router.delete("/:recordType", deleteAcademicRecord);

module.exports = router;
