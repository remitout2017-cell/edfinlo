// routes/workExperienceRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../middlewares/imageUpload");
const { protect } = require("../middlewares/authMiddleware");
const {
  uploadWorkExperience,
  getWorkExperience,
  deleteWorkExperience,
} = require("../controllers/workExperienceController");

// ✅ Upload work experience (OPTIONAL - No KYC verification required)
router.post(
  "/upload",
  protect, // Only authentication required, KYC is optional
  upload.fields([
    { name: "experienceLetter", maxCount: 1 }, // Mandatory
    { name: "offerLetter", maxCount: 1 }, // Optional
    { name: "joiningLetter", maxCount: 1 }, // Optional
    { name: "employeeIdCard", maxCount: 1 }, // Optional
    { name: "salarySlip1", maxCount: 1 }, // Optional
    { name: "salarySlip2", maxCount: 1 }, // Optional
    { name: "salarySlip3", maxCount: 1 }, // Optional
  ]),
  uploadWorkExperience
);

// Get all work experiences
router.get("/my-experience", protect, getWorkExperience);

// Delete work experience
router.delete("/:experienceId", protect, deleteWorkExperience);

module.exports = router;
