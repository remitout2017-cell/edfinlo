const express = require("express");
const router = express.Router();
const upload = require("../middlewares/imageUpload");
const { protect } = require("../middlewares/authMiddleware");
const {
  uploadDocumentsV2,
  getKYCDetailsV2,
  deleteKYCV2,
} = require("../controllers/kycdetailsuplodev2");

// V2 Routes - Enhanced KYC workflow
router.post(
  "/upload-docs",
  protect,
  upload.fields([
    { name: "frontAadhar", maxCount: 1 },
    { name: "backAadhar", maxCount: 1 },
    { name: "frontPan", maxCount: 1 },
    { name: "backPan", maxCount: 1 },
    { name: "passportPhoto", maxCount: 1 },
  ]),
  uploadDocumentsV2
);

router.get("/my-kyc", protect, getKYCDetailsV2);
router.delete("/my-kyc", protect, deleteKYCV2);

module.exports = router;
