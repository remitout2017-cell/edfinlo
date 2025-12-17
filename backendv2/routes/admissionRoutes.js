// routes/admissionRoutes.js - UPDATED WITH V2 ROUTES
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/imageUpload");

// V1 Controller (Original)
const {
  analyzeAdmissionLetterController,
} = require("../controllers/admissionAnalysiscontroller");

// V2 Controller (Enhanced)
let uploadAdmissionLetterV2, getAdmissionLetterV2, deleteAdmissionLetterV2;

try {
  const controllerV2 = require("../controllers/admissionAnalysisControllerV2");
  uploadAdmissionLetterV2 = controllerV2.uploadAdmissionLetterV2;
  getAdmissionLetterV2 = controllerV2.getAdmissionLetterV2;
  deleteAdmissionLetterV2 = controllerV2.deleteAdmissionLetterV2;
} catch (error) {
  console.log("⚠️ V2 controllers not found, using V1 only");
}

// ============================================================================
// V1 ROUTES (Original)
// ============================================================================
router.post(
  "/analyze",
  protect,
  upload.single("admissionLetter"),
  analyzeAdmissionLetterController
);

// ============================================================================
// V2 ROUTES (Enhanced - with delete existing logic)
// ============================================================================
if (uploadAdmissionLetterV2) {
  router.post(
    "/upload",
    protect,
    upload.single("admissionLetter"),
    uploadAdmissionLetterV2
  );

  router.get("/my-admission", protect, getAdmissionLetterV2);
  router.delete("/my-admission", protect, deleteAdmissionLetterV2);

  console.log("✅ Admission Letter V2 routes registered");
} else {
  console.log("ℹ️ Admission Letter V2 routes not available, using V1 only");
}

module.exports = router;
