// routesv2/academicRoutes.js
const express = require("express");
const router = express.Router();
const academicControllerV2 = require("../controllersv2/academicControllerV2");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/imageUpload");

// Define the fields we accept
const uploadFields = upload.fields([
  { name: "class10Marksheet", maxCount: 1 },
  { name: "class12Marksheet", maxCount: 1 },
  { name: "undergraduateMarksheets", maxCount: 10 }, // Allow multiple pages/semesters
  { name: "postgraduateMarksheets", maxCount: 10 },
  { name: "admissionLetter", maxCount: 1 },
]);

router.post(
  "/upload",
  protect,
  uploadFields,
  academicControllerV2.processAcademicDocumentsV2
);
router.get("/status", protect, academicControllerV2.getAcademicStatusV2);

module.exports = router;
