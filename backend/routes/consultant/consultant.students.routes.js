// routes/consultant/consultant.students.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const authorize = require("../../middleware/authorize");
const {
  inviteStudent,
  getAllStudents,
  getStudentProgress,
  getStudentsProgressSummary,
  getPendingInvitations
} = require("../../controllers/consultant/consultant.students.controller");

// All routes require consultant authentication
router.use(authMiddleware);
router.use(authorize("consultant"));

router.post("/invite", inviteStudent);
router.get("/", getAllStudents);
router.get("/progress-summary", getStudentsProgressSummary);
router.get("/invitations", getPendingInvitations);
router.get("/:studentId/progress", getStudentProgress);

module.exports = router;
