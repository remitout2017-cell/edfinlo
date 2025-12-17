// routes/studentEducationPlanRoutes.js
const express = require("express");
const router = express.Router();

const {
  upsertEducationPlan,
  getMyEducationPlan,
} = require("../controllers/studentEducationPlanController");
const { protect } = require("../middlewares/authMiddleware");

// Student creates/updates their plan
router.post("/education-plan", protect, upsertEducationPlan);

// Student fetches their plan
router.get("/education-plan", protect, getMyEducationPlan);

module.exports = router;
