// routesv2/workExperienceRoutes.js

const express = require("express");
const router = express.Router();
const workExpController = require("../controllersv2/workExperienceController");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/imageUpload");

// V2 Work Experience Routes
router.post(
  "/upload",
  protect,
  upload.array("workDocuments", 10), // Allow up to 10 documents
  workExpController.uploadWorkExperienceV2
);

router.get("/my-experience", protect, workExpController.getWorkExperienceV2);
router.delete(
  "/my-experience",
  protect,
  workExpController.deleteWorkExperienceV2
);

module.exports = router;
