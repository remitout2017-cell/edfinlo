// routes/studentEducationPlanRoutes.js
const express = require("express");
const router = express.Router();
const {
  upsertEducationPlan,
  getMyEducationPlan,
} = require("../../controllers/students/studentEducationPlanController");
const authMiddleware = require("../../middleware/authMiddleware");
const authorize = require("../../middleware/authorize");

// Student creates/updates their plan
router.post(
  "/education-plan",
  authMiddleware,
  authorize("student"),
  upsertEducationPlan
);

// Student fetches their plan
router.get(
  "/education-plan",
  authMiddleware,
  authorize("student"),
  getMyEducationPlan
);

module.exports = router;
