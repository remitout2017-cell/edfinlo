// routes/nbfc/nbfc.questionnaire.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const authorize = require("../../middleware/authorize"); // Changed: removed destructuring
const {
  getQuestionnaire,
  updateQuestionnaire,
  getAcceptedStudents,
  addAcceptedStudent,
  updateStudentStatus,
} = require("../../controllers/nbfc/nbfc.questionnaire.controller");

// Authenticate first, then authorize for NBFC role
router.use(authMiddleware);
router.use(authorize("NBFC"));

router.route("/questionnaire").get(getQuestionnaire).put(updateQuestionnaire);

router.route("/students").get(getAcceptedStudents);

router
  .route("/students/:studentId")
  .post(addAcceptedStudent)
  .put(updateStudentStatus);

module.exports = router;
