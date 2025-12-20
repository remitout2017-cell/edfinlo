// routes/students/admission.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/authMiddleware");
const upload = require("../../middleware/imageUpload");

const {
  submitAdmissionLetter,
  getMyAdmissionLetter,
  deleteMyAdmissionLetter,
  healthCheck,
  getScoreAnalysis,
  getScoreComparison,
} = require("../../controllers/students/admission.controller");

// ========== PUBLIC ROUTES ==========
router.get("/health", healthCheck);

// ========== PROTECTED ROUTES ==========
router.use(authMiddleware);

// Admission letter operations
router.post(
  "/submit",
  upload.fields([
    {
      name: "admissionletters",
      maxCount: 3,
    },
  ]),
  submitAdmissionLetter
);

router.get("/me", getMyAdmissionLetter);
router.delete("/me", deleteMyAdmissionLetter);

// Score analysis endpoints
router.get("/analysis", getScoreAnalysis);
router.get("/analysis/comparison", getScoreComparison);

module.exports = router;
