// routes/kycRoutesV2.js
const express = require("express");
const router = express.Router();
const kycControllerV2 = require("../controllersv2/kycControllerV2");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/imageUpload"); // Assuming standard multer config

// Upload Route - Handles multiple files fields
const uploadFields = upload.fields([
  { name: "aadhaarFront", maxCount: 1 },
  { name: "aadhaarBack", maxCount: 1 },
  { name: "panCard", maxCount: 1 },
  { name: "passport", maxCount: 1 },
]);

router.post(
  "/upload",
  protect,
  uploadFields,
  kycControllerV2.uploadDocumentsV2
);
router.get("/status", protect, kycControllerV2.getKYCDetailsV2);

module.exports = router;
