const express = require("express");
const router = express.Router();
const consultantController = require("../controllers/consultantController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");

// Public routes
router.post("/register", consultantController.registerConsultant);
router.post("/login", consultantController.loginConsultant);

// Protected routes (consultant only)
router.use(protect, restrictTo("consultant"));

// ✅ DASHBOARD
router.get("/dashboard", consultantController.getDashboardStats);

// ✅ STUDENT MANAGEMENT
router.get("/students", consultantController.getMyStudents);
router.get("/students/:id", consultantController.getStudentProfile);
router.get("/students/:id/summary", consultantController.getStudentSummary);

// ✅ INVITE MANAGEMENT
router.post("/invite-students", consultantController.inviteStudents);
router.get("/invites", consultantController.getInvites);
router.post("/invites/:id/resend", consultantController.resendInvite);
router.delete("/invites/:id", consultantController.cancelInvite);

// ✅ LOAN REQUESTS
router.get("/loan-requests", consultantController.getLoanRequests);
router.get("/loan-requests/:id", consultantController.getLoanRequestById);
router.get(
  "/students/:id/loan-requests",
  consultantController.getStudentLoanRequests
);

// ✅ ADMISSIONS
router.get("/admissions", consultantController.getAdmissions);
router.get("/admissions/:id", consultantController.getAdmissionById);
router.get(
  "/students/:id/admissions",
  consultantController.getStudentAdmissions
);

// ✅ LOAN ANALYSIS
router.get("/loan-analysis", consultantController.getLoanAnalyses);
router.get(
  "/students/:id/loan-analysis",
  consultantController.getStudentAnalysisHistory
);

// ✅ EXPORTS
router.get("/export/students", consultantController.exportStudents);
router.get("/export/loan-requests", consultantController.exportLoanRequests);

module.exports = router;
