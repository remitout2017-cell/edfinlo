const express = require("express");
const router = express.Router();
const upload = require("../middlewares/imageUpload");
const { protect } = require("../middlewares/authMiddleware");
const { iskycverified } = require("../middlewares/iskycverified");
const {
  uploadClass10DocumentsV2,
  uploadClass12DocumentsV2,
  uploadGraduationDocumentsV2,
  getAcademicRecordsV2,
  deleteHigherEducationV2,
} = require("../controllers/academicRecordsControllerV2");

// V2 Routes - Enhanced Academic workflow
router.post(
  "/upload/class10",
  protect,
  iskycverified,
  upload.single("document"),
  uploadClass10DocumentsV2
);

router.post(
  "/upload/class12",
  protect,
  iskycverified,
  upload.single("document"),
  uploadClass12DocumentsV2
);

router.post(
  "/upload/graduation",
  protect,
  iskycverified,
  upload.array("documents", 10),
  uploadGraduationDocumentsV2
);

router.get("/my-records", protect, getAcademicRecordsV2);
router.delete("/higher-education/:educationId", protect, deleteHigherEducationV2);

module.exports = router;
